import {
  CreateCustomerBody,
  CreateCustomerResponse,
  CreatePromoBody,
  CreatePromoResponse,
  DeleteCustomerParams,
  DeleteCustomerResponse,
  DeletePromoParams,
  DeletePromoResponse,
  FindCustomerByTokenParams,
  FindCustomerByTokenResponse,
  GetAdminSessionResponse,
  GetAdminStatsResponse,
  GetCustomerCardParams,
  GetCustomerCardResponse,
  GetCustomerDetailParams,
  GetCustomerDetailResponse,
  GetQrSvgQueryParams,
  GetReminderSettingsResponse,
  GetShopConfigResponse,
  ListAdminPromosResponse,
  ListCustomersQueryParams,
  ListCustomersResponse,
  ListPublicPromosResponse,
  LoginAdminBody,
  LoginAdminResponse,
  LogoutAdminResponse,
  RecoverCustomerCardBody,
  RecoverCustomerCardResponse,
  RegisterCustomerBody,
  RegisterCustomerResponse,
  RedeemCustomerRewardBody,
  RedeemCustomerRewardParams,
  RedeemCustomerRewardResponse,
  StampCustomerBody,
  StampCustomerParams,
  StampCustomerResponse,
  UpdateCustomerPushConsentBody,
  UpdateCustomerPushConsentResponse,
  UpdateReminderSettingsBody,
  UpdateReminderSettingsResponse,
  UnstampCustomerBody,
  UnstampCustomerParams,
  UnstampCustomerResponse,
  UpdateCustomerBody,
  UpdateCustomerParams,
  UpdateCustomerResponse,
  UpdatePromoBody,
  UpdatePromoParams,
  UpdatePromoResponse,
} from "@workspace/api-zod";
import { Router, type IRouter, type Request, type Response } from "express";
import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import {
  cleanText,
  createCustomer,
  createPromo,
  deleteCustomer,
  deletePromo,
  findCustomerById,
  findCustomerByPhone,
  findCustomerByToken,
  findPromoById,
  getAdminStats,
  getCustomerEvents,
  getReminderSettings as loadReminderSettings,
  getProgramsForCustomer,
  getPublicOffers,
  countPushOptedInCustomers,
  listPushOptedInCustomers,
  listCustomers,
  listPromos,
  normalizePhone,
  progressFor,
  redeemCustomerReward,
  saveReminderSettings,
  SHOP_NAME,
  stampCustomer,
  unstampCustomer,
  updateCustomerPushConsent,
  updateCustomer,
  updatePromo,
  validPhone,
} from "../lib/loyalty-store";
import { qrSvg } from "../lib/qr";
import {
  cancelCustomerReminder,
  oneSignalExternalId,
  syncAllCustomerReminders,
  syncCustomerReminder,
  verifyOneSignalConnection,
} from "../lib/one-signal-reminders";

const router: IRouter = Router();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SESSION_SECRET = process.env.SESSION_SECRET;
const SESSION_DAYS = 60;
const loginAttempts = new Map<string, number[]>();
const registrationAttempts = new Map<string, number[]>();
const recoveryAttempts = new Map<string, number[]>();

function clientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function exceedsLimit(
  store: Map<string, number[]>,
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const recent = (store.get(key) ?? []).filter((timestamp) => now - timestamp < windowMs);
  recent.push(now);
  store.set(key, recent);
  return recent.length > limit;
}

setInterval(() => {
  loginAttempts.clear();
  registrationAttempts.clear();
  recoveryAttempts.clear();
}, 6 * 60 * 60 * 1000).unref();

function signature(value: string): string {
  return createHmac("sha256", SESSION_SECRET ?? "").update(value).digest("base64url");
}

function createSession(): string {
  const expiresAt = Date.now() + SESSION_DAYS * 864e5;
  return `${expiresAt}.${signature(`admin.${expiresAt}`)}`;
}

function getCookie(req: Request, key: string): string | undefined {
  const cookieHeader = req.headers.cookie ?? "";
  for (const part of cookieHeader.split(";")) {
    const [name, ...valueParts] = part.trim().split("=");
    if (name !== key) continue;
    try {
      return decodeURIComponent(valueParts.join("="));
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function isAdmin(req: Request): boolean {
  if (!SESSION_SECRET) return false;
  const session = getCookie(req, "adm");
  if (!session) return false;
  const [expiresAt, suppliedSignature] = session.split(".");
  if (!expiresAt || !suppliedSignature || Number(expiresAt) < Date.now()) return false;
  const expected = signature(`admin.${expiresAt}`);
  if (suppliedSignature.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(suppliedSignature), Buffer.from(expected));
}

function sessionCookie(req: Request, value: string, maxAge: number): string {
  const secure = req.get("x-forwarded-proto")?.includes("https") ? "; Secure" : "";
  return `adm=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function safeEqual(left: string, right: string): boolean {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

function requireAdmin(req: Request, res: Response, next: () => void): void {
  if (!isAdmin(req)) {
    res.status(401).json({ error: "Accesso richiesto." });
    return;
  }
  next();
}

function adminCustomer(
  customer: NonNullable<Awaited<ReturnType<typeof findCustomerById>>>,
  progress: Array<{ promoId: number; stamps: number }>,
) {
  return {
    id: customer.id,
    token: customer.token,
    name: customer.name,
    phone: customer.phone,
    visits: customer.visits,
    created_at: customer.createdAt,
    last_visit: customer.lastVisit,
    progress: progress.map((item) => ({
      promo_id: item.promoId,
      stamps: item.stamps,
    })),
  };
}

function parsePromo(body: unknown, schema: typeof CreatePromoBody | typeof UpdatePromoBody) {
  const parsed = schema.safeParse(body);
  if (!parsed.success) return { error: "Controlla i dati della promozione." } as const;
  const input = parsed.data;
  if (input.kind === "punti") {
    if (!Number.isInteger(input.goal) || !input.goal || input.goal < 1 || input.goal > 30) {
      return { error: "Il numero di timbri deve essere tra 1 e 30." } as const;
    }
    if (!input.reward.trim()) {
      return { error: "Scrivi il premio della raccolta punti." } as const;
    }
  }
  return {
    promo: {
      kind: input.kind,
      title: cleanText(input.title, 40),
      emoji: cleanText(input.emoji, 8) || (input.kind === "punti" ? "✂️" : "🔥"),
      goal: input.kind === "punti" ? input.goal ?? null : null,
      reward: cleanText(input.reward, 80),
      description: String(input.description ?? "").trim().slice(0, 300),
      active: input.active,
      endsAt:
        input.ends_at instanceof Date
          ? input.ends_at.toISOString().slice(0, 10)
          : input.ends_at ?? null,
    },
  } as const;
}

router.get("/config", (_req, res): void => {
  res.json(GetShopConfigResponse.parse({ shopName: SHOP_NAME }));
});

router.get("/promos", async (_req, res): Promise<void> => {
  const promos = await listPromos();
  const response = {
    programs: promos
      .filter((promo) => promo.kind === "punti" && promo.live)
      .map((promo) => ({
        title: promo.title,
        emoji: promo.emoji,
        goal: promo.goal ?? 0,
        reward: promo.reward,
      })),
    offers: await getPublicOffers(),
  };
  res.json(ListPublicPromosResponse.parse(response));
});

router.post("/register", async (req, res): Promise<void> => {
  if (exceedsLimit(registrationAttempts, clientIp(req), 20, 36e5)) {
    res.status(429).json({ error: "Troppi tentativi, riprova più tardi." });
    return;
  }
  const parsed = RegisterCustomerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Inserisci nome e numero di telefono validi." });
    return;
  }
  const name = cleanText(parsed.data.name, 60);
  const phone = normalizePhone(parsed.data.phone);
  if (name.length < 2 || !validPhone(phone)) {
    res.status(400).json({ error: "Inserisci nome e numero di telefono validi." });
    return;
  }
  const result = await createCustomer(name, phone);
  res.json(
    RegisterCustomerResponse.parse({
      token: result.customer.token,
      created: result.created,
    }),
  );
});

router.post("/recover", async (req, res): Promise<void> => {
  if (exceedsLimit(recoveryAttempts, clientIp(req), 10, 36e5)) {
    res.status(429).json({ error: "Troppi tentativi, riprova più tardi." });
    return;
  }
  const parsed = RecoverCustomerCardBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Numero di telefono non valido." });
    return;
  }
  const phone = normalizePhone(parsed.data.phone);
  if (!validPhone(phone)) {
    res.status(400).json({ error: "Numero di telefono non valido." });
    return;
  }
  const customer = await findCustomerByPhone(phone);
  if (!customer) {
    res.status(404).json({ error: "Nessuna tessera con questo numero." });
    return;
  }
  res.json(RecoverCustomerCardResponse.parse({ token: customer.token }));
});

router.get("/card/:token", async (req, res): Promise<void> => {
  const params = GetCustomerCardParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Codice tessera non valido." });
    return;
  }
  const customer = await findCustomerByToken(params.data.token);
  if (!customer) {
    res.status(404).json({ error: "Tessera non trovata." });
    return;
  }
  const reminderSettings = await loadReminderSettings();
  const pushAvailable = await verifyOneSignalConnection();
  const response = {
    shopName: SHOP_NAME,
    name: customer.name,
    visits: customer.visits,
    reminders_enabled: reminderSettings.enabled,
    reminder_after_days: reminderSettings.afterDays,
    push_available: pushAvailable,
    push_external_id: pushAvailable ? oneSignalExternalId(customer.id) : null,
    push_opted_in: customer.pushOptedIn,
    programs: await getProgramsForCustomer(customer.id),
    offers: await getPublicOffers(),
  };
  res.json(GetCustomerCardResponse.parse(response));
});

router.patch("/push/consent", async (req, res): Promise<void> => {
  const parsed = UpdateCustomerPushConsentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Preferenza notifiche non valida." });
    return;
  }
  const customer = await findCustomerByToken(parsed.data.token);
  if (!customer) {
    res.status(404).json({ error: "Tessera non trovata." });
    return;
  }
  if (!(await verifyOneSignalConnection())) {
    res.status(503).json({ error: "Notifiche push non configurate." });
    return;
  }

  if (parsed.data.enabled) {
    const settings = await loadReminderSettings();
    if (!settings.enabled) {
      res.status(409).json({ error: "I promemoria non sono attivi al momento." });
      return;
    }
    const updated = await updateCustomerPushConsent(customer.id, true);
    if (!updated) {
      res.status(404).json({ error: "Tessera non trovata." });
      return;
    }
    try {
      await syncCustomerReminder(updated, settings);
    } catch {
      await updateCustomerPushConsent(customer.id, false);
      res.status(502).json({ error: "Non siamo riusciti ad attivare il promemoria. Riprova." });
      return;
    }
    res.json(UpdateCustomerPushConsentResponse.parse({ enabled: true }));
    return;
  }

  try {
    await cancelCustomerReminder(customer);
  } catch {
    res.status(502).json({ error: "Non siamo riusciti ad aggiornare la preferenza. Riprova." });
    return;
  }
  await updateCustomerPushConsent(customer.id, false);
  res.json(UpdateCustomerPushConsentResponse.parse({ enabled: false }));
});

router.get("/qr.svg", async (req, res): Promise<void> => {
  const parsed = GetQrSvgQueryParams.safeParse(req.query);
  if (!parsed.success || !parsed.data.d) {
    res.status(400).type("text/plain").send("Manca il testo");
    return;
  }
  try {
    const svg = await qrSvg(parsed.data.d.slice(0, 300));
    res
      .status(200)
      .type("image/svg+xml")
      .set("Cache-Control", "public, max-age=86400")
      .send(svg);
  } catch {
    res.status(400).type("text/plain").send("Testo troppo lungo per il QR.");
  }
});

router.post("/admin/login", (req, res): void => {
  if (exceedsLimit(loginAttempts, clientIp(req), 10, 15 * 60 * 1000)) {
    res.status(429).json({ error: "Troppi tentativi. Attendi 15 minuti." });
    return;
  }
  if (!ADMIN_PASSWORD || !SESSION_SECRET) {
    res.status(503).json({ error: "Accesso amministratore non configurato." });
    return;
  }
  const parsed = LoginAdminBody.safeParse(req.body);
  if (!parsed.success || !safeEqual(parsed.data.password, ADMIN_PASSWORD)) {
    res.status(401).json({ error: "Password errata." });
    return;
  }
  res
    .cookie("adm", createSession(), {
      httpOnly: true,
      sameSite: "lax",
      secure: req.get("x-forwarded-proto")?.includes("https") ?? false,
      maxAge: SESSION_DAYS * 864e5,
      path: "/",
    })
    .json(LoginAdminResponse.parse({ ok: true }));
});

router.post("/admin/logout", (req, res): void => {
  res
    .cookie("adm", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: req.get("x-forwarded-proto")?.includes("https") ?? false,
      maxAge: 0,
      path: "/",
    })
    .json(LogoutAdminResponse.parse({ ok: true }));
});

router.get("/admin/me", requireAdmin, (_req, res): void => {
  res.json(GetAdminSessionResponse.parse({ ok: true, shopName: SHOP_NAME }));
});

router.get("/admin/stats", requireAdmin, async (_req, res): Promise<void> => {
  res.json(GetAdminStatsResponse.parse(await getAdminStats()));
});

router.get("/admin/reminder-settings", requireAdmin, async (_req, res): Promise<void> => {
  const [settings, subscribedCustomers] = await Promise.all([
    loadReminderSettings(),
    countPushOptedInCustomers(),
  ]);
  res.json(
    GetReminderSettingsResponse.parse({
      enabled: settings.enabled,
      after_days: settings.afterDays,
      title: settings.title,
      message: settings.message,
      push_available: await verifyOneSignalConnection(),
      subscribed_customers: subscribedCustomers,
    }),
  );
});

router.put("/admin/reminder-settings", requireAdmin, async (req, res): Promise<void> => {
  const parsed = UpdateReminderSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Controlla i dati del promemoria." });
    return;
  }
  if (parsed.data.enabled && !(await verifyOneSignalConnection())) {
    res.status(503).json({ error: "Collegamento OneSignal non configurato." });
    return;
  }
  const input = {
    enabled: parsed.data.enabled,
    afterDays: parsed.data.after_days,
    title: parsed.data.title.trim(),
    message: parsed.data.message.trim(),
  };
  if (!input.title || !input.message) {
    res.status(400).json({ error: "Inserisci titolo e testo del promemoria." });
    return;
  }

  const previous = await loadReminderSettings();
  const saved = await saveReminderSettings(input);
  const changed =
    previous.enabled !== saved.enabled ||
    previous.afterDays !== saved.afterDays ||
    previous.title !== saved.title ||
    previous.message !== saved.message;
  if (changed) {
    const customers = await listPushOptedInCustomers();
    const result = await syncAllCustomerReminders(customers, saved);
    if (result.failed > 0) {
      req.log.error(
        { failed: result.failed, subscribedCustomers: customers.length },
        "Some OneSignal reminders could not be synchronized",
      );
      res.status(502).json({
        error: "Impostazioni salvate, ma alcuni promemoria non sono stati aggiornati. Riprova.",
      });
      return;
    }
  }
  const subscribedCustomers = await countPushOptedInCustomers();
  res.json(
    UpdateReminderSettingsResponse.parse({
      enabled: saved.enabled,
      after_days: saved.afterDays,
      title: saved.title,
      message: saved.message,
      push_available: await verifyOneSignalConnection(),
      subscribed_customers: subscribedCustomers,
    }),
  );
});

router.get("/admin/promos", requireAdmin, async (_req, res): Promise<void> => {
  res.json(ListAdminPromosResponse.parse(await listPromos()));
});

router.post("/admin/promos", requireAdmin, async (req, res): Promise<void> => {
  const parsed = parsePromo(req.body, CreatePromoBody);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  res.json(CreatePromoResponse.parse(await createPromo(parsed.promo)));
});

router.put("/admin/promos/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdatePromoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Promozione non valida." });
    return;
  }
  const parsed = parsePromo(req.body, UpdatePromoBody);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const updated = await updatePromo(params.data.id, parsed.promo);
  if (!updated) {
    res.status(404).json({ error: "Promozione non trovata." });
    return;
  }
  res.json(UpdatePromoResponse.parse(updated));
});

router.delete("/admin/promos/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeletePromoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Promozione non valida." });
    return;
  }
  await deletePromo(params.data.id);
  res.json(DeletePromoResponse.parse({ ok: true }));
});

router.get("/admin/customers", requireAdmin, async (req, res): Promise<void> => {
  const parsed = ListCustomersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Ricerca non valida." });
    return;
  }
  const rawSearch = cleanText(parsed.data.q, 40);
  const search = /^[\d\s+]+$/.test(rawSearch)
    ? normalizePhone(rawSearch) || rawSearch.replace(/\D/g, "")
    : rawSearch;
  const customers = await listCustomers(search);
  const progress = await progressFor(customers.map((customer) => customer.id));
  const response = customers.map((customer) =>
    adminCustomer(
      customer,
      progress.filter((item) => item.customerId === customer.id),
    ),
  );
  res.json(ListCustomersResponse.parse(response));
});

router.post("/admin/customers", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateCustomerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Inserisci nome e numero validi." });
    return;
  }
  const name = cleanText(parsed.data.name, 60);
  const phone = normalizePhone(parsed.data.phone);
  if (name.length < 2 || !validPhone(phone)) {
    res.status(400).json({ error: "Inserisci nome e numero validi." });
    return;
  }
  const result = await createCustomer(name, phone);
  const [progress] = await Promise.all([progressFor([result.customer.id])]);
  res.json(
    CreateCustomerResponse.parse({
      customer: adminCustomer(result.customer, progress),
      created: result.created,
    }),
  );
});

router.get("/admin/token/:token", requireAdmin, async (req, res): Promise<void> => {
  const params = FindCustomerByTokenParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Codice tessera non valido." });
    return;
  }
  const customer = await findCustomerByToken(params.data.token);
  if (!customer) {
    res.status(404).json({ error: "Tessera non riconosciuta." });
    return;
  }
  const progress = await progressFor([customer.id]);
  res.json(FindCustomerByTokenResponse.parse(adminCustomer(customer, progress)));
});

router.get("/admin/customers/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = GetCustomerDetailParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Cliente non valido." });
    return;
  }
  const customer = await findCustomerById(params.data.id);
  if (!customer) {
    res.status(404).json({ error: "Cliente non trovato." });
    return;
  }
  const [progress, programs, events] = await Promise.all([
    progressFor([customer.id]),
    getProgramsForCustomer(customer.id),
    getCustomerEvents(customer.id),
  ]);
  res.json(
    GetCustomerDetailResponse.parse({
      customer: adminCustomer(customer, progress),
      programs,
      events,
    }),
  );
});

router.put("/admin/customers/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateCustomerParams.safeParse(req.params);
  const parsed = UpdateCustomerBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Dati cliente non validi." });
    return;
  }
  const name = cleanText(parsed.data.name, 60);
  const phone = normalizePhone(parsed.data.phone);
  if (name.length < 2 || !validPhone(phone)) {
    res.status(400).json({ error: "Dati cliente non validi." });
    return;
  }
  const other = await findCustomerByPhone(phone);
  if (other && other.id !== params.data.id) {
    res.status(409).json({ error: "Numero già usato da un altro cliente." });
    return;
  }
  const updated = await updateCustomer(params.data.id, name, phone);
  if (!updated) {
    res.status(404).json({ error: "Cliente non trovato." });
    return;
  }
  const progress = await progressFor([updated.id]);
  res.json(UpdateCustomerResponse.parse(adminCustomer(updated, progress)));
});

router.delete("/admin/customers/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteCustomerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Cliente non valido." });
    return;
  }
  const customer = await findCustomerById(params.data.id);
  if (customer?.reminderNotificationId) {
    try {
      await cancelCustomerReminder(customer);
    } catch {
      res.status(502).json({ error: "Non siamo riusciti ad annullare il promemoria del cliente." });
      return;
    }
  }
  await deleteCustomer(params.data.id);
  res.json(DeleteCustomerResponse.parse({ ok: true }));
});

async function applyStampAction(
  req: Request,
  res: Response,
  action: "stamp" | "unstamp" | "redeem",
): Promise<void> {
  const paramsSchema = action === "stamp"
    ? StampCustomerParams
    : action === "unstamp"
      ? UnstampCustomerParams
      : RedeemCustomerRewardParams;
  const bodySchema = action === "stamp"
    ? StampCustomerBody
    : action === "unstamp"
      ? UnstampCustomerBody
      : RedeemCustomerRewardBody;
  const params = paramsSchema.safeParse(req.params);
  const body = bodySchema.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Azione non valida." });
    return;
  }
  const customer = await findCustomerById(params.data.id);
  if (!customer) {
    res.status(404).json({ error: "Cliente non trovato." });
    return;
  }
  const promo = await findPromoById(body.data.promoId);
  if (!promo || promo.kind !== "punti") {
    res.status(400).json({ error: "Scegli una raccolta punti." });
    return;
  }
  if (action !== "unstamp" && !promo.live) {
    res.status(409).json({ error: "Questa promozione non è attiva." });
    return;
  }
  const goal = promo.goal ?? 0;
  const progress =
    action === "stamp"
      ? await stampCustomer(customer.id, promo.id, goal)
      : action === "unstamp"
        ? await unstampCustomer(customer.id, promo.id)
        : await redeemCustomerReward(customer.id, promo.id, goal);
  if (!progress) {
    const error = {
      stamp: "Tessera piena: riscatta prima il premio.",
      unstamp: "Non ci sono timbri da togliere.",
      redeem: `Servono ${goal} timbri per il premio.`,
    }[action];
    res.status(409).json({ error });
    return;
  }
  if (action === "stamp" || action === "redeem") {
    const updatedCustomer = await findCustomerById(customer.id);
    if (updatedCustomer) {
      try {
        await syncCustomerReminder(updatedCustomer, await loadReminderSettings());
      } catch {
        req.log.warn(
          { customerId: customer.id },
          "Could not refresh the customer's scheduled reminder",
        );
      }
    }
  }
  const response = {
    promo_id: progress.promoId,
    stamps: progress.stamps,
    rewards: progress.rewards,
    goal,
  };
  if (action === "stamp") {
    res.json(StampCustomerResponse.parse(response));
  } else if (action === "unstamp") {
    res.json(UnstampCustomerResponse.parse(response));
  } else {
    res.json(RedeemCustomerRewardResponse.parse(response));
  }
}

router.post(
  "/admin/customers/:id/stamp",
  requireAdmin,
  async (req, res): Promise<void> => applyStampAction(req, res, "stamp"),
);
router.post(
  "/admin/customers/:id/unstamp",
  requireAdmin,
  async (req, res): Promise<void> => applyStampAction(req, res, "unstamp"),
);
router.post(
  "/admin/customers/:id/redeem",
  requireAdmin,
  async (req, res): Promise<void> => applyStampAction(req, res, "redeem"),
);

export default router;
