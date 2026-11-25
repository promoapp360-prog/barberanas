import { and, asc, count, desc, eq, gte, ilike, inArray, lt, or, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  loyaltyCustomersTable,
  loyaltyEventsTable,
  loyaltyProgressTable,
  loyaltyPromosTable,
  loyaltyReminderSettingsTable,
} from "@workspace/db";
import type {
  InsertLoyaltyPromo,
  InsertLoyaltyReminderSettings,
} from "@workspace/db";
import { randomBytes } from "node:crypto";

export const SHOP_NAME = process.env.SHOP_NAME || "Anas Barber";

const DEFAULT_PROMO: InsertLoyaltyPromo = {
  kind: "punti",
  title: "Taglio",
  emoji: "✂️",
  goal: 6,
  reward: "Il 7° taglio è gratis",
  description: "",
  active: true,
  endsAt: null,
};

export const cleanText = (value: unknown, maxLength: number): string =>
  String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);

export const normalizePhone = (value: unknown): string => {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (digits.startsWith("0039")) digits = digits.slice(4);
  else if (digits.startsWith("39") && digits.length >= 11) digits = digits.slice(2);
  return digits;
};

export const validPhone = (digits: string): boolean =>
  digits.length >= 8 && digits.length <= 13;

export async function ensureDefaultPromo(): Promise<void> {
  const existing = await db
    .select({ id: loyaltyPromosTable.id })
    .from(loyaltyPromosTable)
    .limit(1);
  if (!existing.length) {
    await db.insert(loyaltyPromosTable).values(DEFAULT_PROMO);
  }
}

export async function ensureDefaultReminderSettings(): Promise<void> {
  await db
    .insert(loyaltyReminderSettingsTable)
    .values({ id: 1, enabled: true })
    .onConflictDoNothing();
}

export async function getReminderSettings() {
  const [settings] = await db
    .select()
    .from(loyaltyReminderSettingsTable)
    .where(eq(loyaltyReminderSettingsTable.id, 1))
    .limit(1);
  if (settings) return settings;
  await ensureDefaultReminderSettings();
  const [created] = await db
    .select()
    .from(loyaltyReminderSettingsTable)
    .where(eq(loyaltyReminderSettingsTable.id, 1))
    .limit(1);
  if (!created) throw new Error("Impostazioni promemoria non disponibili.");
  return created;
}

export async function saveReminderSettings(
  settings: InsertLoyaltyReminderSettings,
) {
  const [saved] = await db
    .insert(loyaltyReminderSettingsTable)
    .values({ id: 1, ...settings })
    .onConflictDoUpdate({
      target: loyaltyReminderSettingsTable.id,
      set: { ...settings, updatedAt: new Date() },
    })
    .returning();
  return saved;
}

export async function countPushOptedInCustomers(): Promise<number> {
  const [result] = await db
    .select({ total: count() })
    .from(loyaltyCustomersTable)
    .where(eq(loyaltyCustomersTable.pushOptedIn, true));
  return result?.total ?? 0;
}

export async function listPushOptedInCustomers() {
  return db
    .select()
    .from(loyaltyCustomersTable)
    .where(eq(loyaltyCustomersTable.pushOptedIn, true));
}

export async function updateCustomerPushConsent(id: number, enabled: boolean) {
  const [updated] = await db
    .update(loyaltyCustomersTable)
    .set({ pushOptedIn: enabled })
    .where(eq(loyaltyCustomersTable.id, id))
    .returning();
  return updated ?? null;
}

export async function updateCustomerReminderSchedule(
  id: number,
  notificationId: string | null,
  scheduledAt: Date | null,
): Promise<void> {
  await db
    .update(loyaltyCustomersTable)
    .set({
      reminderNotificationId: notificationId,
      reminderScheduledAt: scheduledAt,
    })
    .where(eq(loyaltyCustomersTable.id, id));
}

export function isPromoLive(promo: {
  active: boolean;
  endsAt: string | null;
}): boolean {
  if (!promo.active) return false;
  if (!promo.endsAt) return true;
  const today = new Date().toLocaleDateString("sv-SE", {
    timeZone: "Europe/Rome",
  });
  return promo.endsAt >= today;
}

export async function findCustomerByPhone(phone: string) {
  const [customer] = await db
    .select()
    .from(loyaltyCustomersTable)
    .where(eq(loyaltyCustomersTable.phone, phone))
    .limit(1);
  return customer ?? null;
}

export async function findCustomerByToken(token: string) {
  const [customer] = await db
    .select()
    .from(loyaltyCustomersTable)
    .where(eq(loyaltyCustomersTable.token, token))
    .limit(1);
  return customer ?? null;
}

export async function findCustomerById(id: number) {
  const [customer] = await db
    .select()
    .from(loyaltyCustomersTable)
    .where(eq(loyaltyCustomersTable.id, id))
    .limit(1);
  return customer ?? null;
}

export async function createCustomer(name: string, phone: string) {
  const token = randomBytes(12).toString("base64url");
  const [customer] = await db
    .insert(loyaltyCustomersTable)
    .values({ token, name, phone })
    .onConflictDoNothing({ target: loyaltyCustomersTable.phone })
    .returning();

  if (customer) {
    await db.insert(loyaltyEventsTable).values({
      customerId: customer.id,
      type: "iscrizione",
    });
    return { customer, created: true };
  }

  const existing = await findCustomerByPhone(phone);
  if (!existing) throw new Error("Impossibile recuperare il cliente appena creato.");
  return { customer: existing, created: false };
}

export async function listCustomers(search = "") {
  const filters = search
    ? or(
        ilike(loyaltyCustomersTable.name, `%${search}%`),
        ilike(loyaltyCustomersTable.phone, `%${search}%`),
      )
    : undefined;
  return db
    .select()
    .from(loyaltyCustomersTable)
    .where(filters)
    .orderBy(
      sql`${loyaltyCustomersTable.lastVisit} DESC NULLS LAST`,
      desc(loyaltyCustomersTable.createdAt),
    )
    .limit(100);
}

export async function progressFor(customerIds: number[]) {
  if (!customerIds.length) return [];
  return db
    .select()
    .from(loyaltyProgressTable)
    .where(inArray(loyaltyProgressTable.customerId, customerIds));
}

export async function listPromos() {
  const promos = await db
    .select()
    .from(loyaltyPromosTable)
    .orderBy(
      desc(loyaltyPromosTable.active),
      desc(loyaltyPromosTable.kind),
      asc(loyaltyPromosTable.createdAt),
    );
  return promos.map((promo) => ({ ...promo, live: isPromoLive(promo) }));
}

export async function findPromoById(id: number) {
  const [promo] = await db
    .select()
    .from(loyaltyPromosTable)
    .where(eq(loyaltyPromosTable.id, id))
    .limit(1);
  return promo ? { ...promo, live: isPromoLive(promo) } : null;
}

export async function createPromo(promo: InsertLoyaltyPromo) {
  const [created] = await db
    .insert(loyaltyPromosTable)
    .values(promo)
    .returning();
  return { ...created, live: isPromoLive(created) };
}

export async function updatePromo(id: number, promo: InsertLoyaltyPromo) {
  const [updated] = await db
    .update(loyaltyPromosTable)
    .set(promo)
    .where(eq(loyaltyPromosTable.id, id))
    .returning();
  return updated ? { ...updated, live: isPromoLive(updated) } : null;
}

export async function deletePromo(id: number) {
  const [deleted] = await db
    .delete(loyaltyPromosTable)
    .where(eq(loyaltyPromosTable.id, id))
    .returning({ id: loyaltyPromosTable.id });
  return Boolean(deleted);
}

export async function getProgramsForCustomer(customerId: number) {
  const promos = await listPromos();
  const livePromos = promos.filter(
    (promo) => promo.kind === "punti" && promo.live,
  );
  const progress = await progressFor([customerId]);
  return livePromos.map((promo) => {
    const row = progress.find((item) => item.promoId === promo.id);
    return {
      id: promo.id,
      title: promo.title,
      emoji: promo.emoji,
      goal: promo.goal ?? 0,
      reward: promo.reward,
      description: promo.description,
      ends_at: promo.endsAt,
      stamps: Math.min(row?.stamps ?? 0, promo.goal ?? 0),
      rewards: row?.rewards ?? 0,
    };
  });
}

export async function getPublicOffers() {
  const promos = await listPromos();
  return promos
    .filter((promo) => promo.kind === "offerta" && promo.live)
    .map((promo) => ({
      id: promo.id,
      title: promo.title,
      emoji: promo.emoji,
      description: promo.description,
      ends_at: promo.endsAt,
    }));
}

export async function updateCustomer(id: number, name: string, phone: string) {
  const [updated] = await db
    .update(loyaltyCustomersTable)
    .set({ name, phone })
    .where(eq(loyaltyCustomersTable.id, id))
    .returning();
  return updated ?? null;
}

export async function deleteCustomer(id: number) {
  const [deleted] = await db
    .delete(loyaltyCustomersTable)
    .where(eq(loyaltyCustomersTable.id, id))
    .returning({ id: loyaltyCustomersTable.id });
  return Boolean(deleted);
}

export async function getCustomerEvents(customerId: number) {
  return db
    .select({
      type: loyaltyEventsTable.type,
      created_at: loyaltyEventsTable.createdAt,
      promo: loyaltyPromosTable.title,
      emoji: loyaltyPromosTable.emoji,
    })
    .from(loyaltyEventsTable)
    .leftJoin(
      loyaltyPromosTable,
      eq(loyaltyEventsTable.promoId, loyaltyPromosTable.id),
    )
    .where(eq(loyaltyEventsTable.customerId, customerId))
    .orderBy(desc(loyaltyEventsTable.createdAt))
    .limit(50);
}

export async function stampCustomer(
  customerId: number,
  promoId: number,
  goal: number,
) {
  return db.transaction(async (tx) => {
    await tx
      .insert(loyaltyProgressTable)
      .values({ customerId, promoId })
      .onConflictDoNothing();
    const [updated] = await tx
      .update(loyaltyProgressTable)
      .set({ stamps: sql`${loyaltyProgressTable.stamps} + 1` })
      .where(
        and(
          eq(loyaltyProgressTable.customerId, customerId),
          eq(loyaltyProgressTable.promoId, promoId),
          lt(loyaltyProgressTable.stamps, goal),
        ),
      )
      .returning();
    if (!updated) return null;
    await tx
      .update(loyaltyCustomersTable)
      .set({ visits: sql`${loyaltyCustomersTable.visits} + 1`, lastVisit: new Date() })
      .where(eq(loyaltyCustomersTable.id, customerId));
    await tx.insert(loyaltyEventsTable).values({
      customerId,
      promoId,
      type: "timbro",
    });
    return updated;
  });
}

export async function unstampCustomer(customerId: number, promoId: number) {
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(loyaltyProgressTable)
      .set({ stamps: sql`${loyaltyProgressTable.stamps} - 1` })
      .where(
        and(
          eq(loyaltyProgressTable.customerId, customerId),
          eq(loyaltyProgressTable.promoId, promoId),
          gte(loyaltyProgressTable.stamps, 1),
        ),
      )
      .returning();
    if (!updated) return null;
    await tx
      .update(loyaltyCustomersTable)
      .set({ visits: sql`greatest(${loyaltyCustomersTable.visits} - 1, 0)` })
      .where(eq(loyaltyCustomersTable.id, customerId));
    await tx.insert(loyaltyEventsTable).values({
      customerId,
      promoId,
      type: "correzione",
    });
    return updated;
  });
}

export async function redeemCustomerReward(
  customerId: number,
  promoId: number,
  goal: number,
) {
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(loyaltyProgressTable)
      .set({
        stamps: 0,
        rewards: sql`${loyaltyProgressTable.rewards} + 1`,
      })
      .where(
        and(
          eq(loyaltyProgressTable.customerId, customerId),
          eq(loyaltyProgressTable.promoId, promoId),
          gte(loyaltyProgressTable.stamps, goal),
        ),
      )
      .returning();
    if (!updated) return null;
    await tx
      .update(loyaltyCustomersTable)
      .set({ visits: sql`${loyaltyCustomersTable.visits} + 1`, lastVisit: new Date() })
      .where(eq(loyaltyCustomersTable.id, customerId));
    await tx.insert(loyaltyEventsTable).values({
      customerId,
      promoId,
      type: "omaggio",
    });
    return updated;
  });
}

export async function getAdminStats() {
  const [{ customers }] = await db
    .select({ customers: count() })
    .from(loyaltyCustomersTable);
  const [{ rewards }] = await db
    .select({
      rewards: sql<number>`coalesce(sum(${loyaltyProgressTable.rewards}), 0)::int`,
    })
    .from(loyaltyProgressTable);
  const readyRows = await db
    .select({ customerId: loyaltyProgressTable.customerId })
    .from(loyaltyProgressTable)
    .innerJoin(
      loyaltyPromosTable,
      eq(loyaltyProgressTable.promoId, loyaltyPromosTable.id),
    )
    .where(
      and(
        eq(loyaltyPromosTable.active, true),
        sql`${loyaltyPromosTable.goal} IS NOT NULL`,
        gte(loyaltyProgressTable.stamps, loyaltyPromosTable.goal),
      ),
    );
  const todayEvents = await db
    .select({ total: count() })
    .from(loyaltyEventsTable)
    .where(
      and(
        inArray(loyaltyEventsTable.type, ["timbro", "omaggio"]),
        sql`(${loyaltyEventsTable.createdAt} AT TIME ZONE 'Europe/Rome')::date = (now() AT TIME ZONE 'Europe/Rome')::date`,
      ),
    );
  return {
    customers,
    rewards,
    ready: new Set(readyRows.map((row) => row.customerId)).size,
    today: todayEvents[0]?.total ?? 0,
  };
}

