import { createHmac, randomUUID } from "node:crypto";
import type { LoyaltyCustomer, LoyaltyReminderSettings } from "@workspace/db";
import { logger } from "./logger";
import { updateCustomerReminderSchedule } from "./loyalty-store";

const ONESIGNAL_API = "https://api.onesignal.com";
const REMINDER_ORIGIN = process.env.ONESIGNAL_SITE_URL || "https://anas.promoapp.it";
let verificationResult: boolean | null = null;
let verificationExpiresAt = 0;
let verificationPromise: Promise<boolean> | null = null;

export function isOneSignalReady(): boolean {
  return Boolean(
    process.env.ONESIGNAL_APP_ID &&
    process.env.ONESIGNAL_APP_API_KEY &&
    process.env.SESSION_SECRET,
  );
}

export function oneSignalExternalId(customerId: number): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Secret interno non configurato.");
  return createHmac("sha256", secret)
    .update(`barber-customer:${customerId}`)
    .digest("hex");
}

function appId(): string {
  const value = process.env.ONESIGNAL_APP_ID;
  if (!value) throw new Error("OneSignal App ID non configurato.");
  return value;
}

function appApiKey(): string {
  const value = process.env.ONESIGNAL_APP_API_KEY;
  if (!value) throw new Error("OneSignal API key non configurata.");
  return value;
}

export async function verifyOneSignalConnection(): Promise<boolean> {
  if (!isOneSignalReady()) return false;
  if (verificationResult !== null && Date.now() < verificationExpiresAt) {
    return verificationResult;
  }
  if (verificationPromise) return verificationPromise;

  verificationPromise = (async () => {
    try {
      const response = await fetch(
        `${ONESIGNAL_API}/apps/${encodeURIComponent(appId())}/segments?limit=1`,
        {
          headers: { Authorization: `Key ${appApiKey()}` },
          signal: AbortSignal.timeout(5000),
        },
      );
      await response.body?.cancel();
      verificationResult = response.ok;
      verificationExpiresAt = Date.now() + (response.ok ? 60_000 : 15_000);
      if (!response.ok) {
        logger.warn(
          { statusCode: response.status },
          "OneSignal app key could not access the configured app",
        );
      }
      return response.ok;
    } catch {
      verificationResult = false;
      verificationExpiresAt = Date.now() + 15_000;
      logger.warn("OneSignal app key check failed");
      return false;
    } finally {
      verificationPromise = null;
    }
  })();
  return verificationPromise;
}

async function oneSignalRequest(path: string, init: RequestInit = {}) {
  const response = await fetch(`${ONESIGNAL_API}${path}`, {
    ...init,
    signal: AbortSignal.timeout(5000),
    headers: {
      Authorization: `Key ${appApiKey()}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (response.status === 404 && init.method === "DELETE") return null;
  if (!response.ok) {
    logger.error(
      { statusCode: response.status },
      "OneSignal request failed",
    );
    throw new Error(`OneSignal ha risposto con errore ${response.status}.`);
  }
  if (response.status === 204) return null;
  return response.json() as Promise<{ id?: string }>;
}

async function cancelExistingReminder(customer: LoyaltyCustomer): Promise<void> {
  if (!customer.reminderNotificationId) return;
  const query = new URLSearchParams({ app_id: appId() });
  await oneSignalRequest(
    `/notifications/${encodeURIComponent(customer.reminderNotificationId)}?${query}`,
    { method: "DELETE" },
  );
  await updateCustomerReminderSchedule(customer.id, null, null);
}

export async function syncCustomerReminder(
  customer: LoyaltyCustomer,
  settings: LoyaltyReminderSettings,
): Promise<boolean> {
  if (!isOneSignalReady()) {
    throw new Error("Collegamento OneSignal non configurato.");
  }

  await cancelExistingReminder(customer);
  if (!settings.enabled || !customer.pushOptedIn) return false;

  const lastVisitOrRegistration = customer.lastVisit ?? customer.createdAt;
  const dueAt = new Date(
    lastVisitOrRegistration.getTime() + settings.afterDays * 24 * 60 * 60 * 1000,
  );
  const sendAt =
    dueAt.getTime() > Date.now()
      ? dueAt
      : new Date(Date.now() + 60_000);
  const body = {
    app_id: appId(),
    include_aliases: { external_id: [oneSignalExternalId(customer.id)] },
    target_channel: "push",
    headings: { it: settings.title },
    contents: { it: settings.message },
    url: `${REMINDER_ORIGIN}/`,
    send_after: sendAt.toISOString(),
    idempotency_key: randomUUID(),
  };
  const created = await oneSignalRequest("/notifications?c=push", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const notificationId = created?.id;
  if (!notificationId) return false;
  await updateCustomerReminderSchedule(customer.id, notificationId, sendAt);
  return true;
}

export async function cancelCustomerReminder(
  customer: LoyaltyCustomer,
): Promise<void> {
  if (!isOneSignalReady()) {
    if (customer.reminderNotificationId) {
      throw new Error("Impossibile annullare il promemoria senza OneSignal.");
    }
    return;
  }
  await cancelExistingReminder(customer);
}

export async function syncAllCustomerReminders(
  customers: LoyaltyCustomer[],
  settings: LoyaltyReminderSettings,
): Promise<{ scheduled: number; failed: number }> {
  let scheduled = 0;
  let failed = 0;
  for (const customer of customers) {
    try {
      if (await syncCustomerReminder(customer, settings)) scheduled += 1;
    } catch {
      failed += 1;
    }
  }
  return { scheduled, failed };
}
