import { createInsertSchema } from "drizzle-zod";
import { boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const loyaltyReminderSettingsTable = pgTable("loyalty_reminder_settings", {
  id: integer("id").primaryKey().default(1),
  enabled: boolean("enabled").notNull().default(true),
  afterDays: integer("after_days").notNull().default(30),
  title: text("title").notNull().default("Ti aspettiamo da Da Barber Anas"),
  message: text("message")
    .notNull()
    .default("È passato un po’ di tempo dall’ultima visita. Passa in barberia per il tuo prossimo taglio."),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertLoyaltyReminderSettingsSchema = createInsertSchema(
  loyaltyReminderSettingsTable,
).omit({ updatedAt: true });
export type InsertLoyaltyReminderSettings = z.infer<
  typeof insertLoyaltyReminderSettingsSchema
>;
export type LoyaltyReminderSettings =
  typeof loyaltyReminderSettingsTable.$inferSelect;
