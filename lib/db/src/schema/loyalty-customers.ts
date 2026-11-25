import { createInsertSchema } from "drizzle-zod";
import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const loyaltyCustomersTable = pgTable("loyalty_customers", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  name: text("name").notNull(),
  phone: text("phone").notNull().unique(),
  visits: integer("visits").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastVisit: timestamp("last_visit", { withTimezone: true }),
  pushOptedIn: boolean("push_opted_in").notNull().default(false),
  reminderNotificationId: text("reminder_notification_id"),
  reminderScheduledAt: timestamp("reminder_scheduled_at", { withTimezone: true }),
});

export const insertLoyaltyCustomerSchema = createInsertSchema(loyaltyCustomersTable).omit({
  id: true,
  createdAt: true,
  lastVisit: true,
  visits: true,
  pushOptedIn: true,
  reminderNotificationId: true,
  reminderScheduledAt: true,
});
export type InsertLoyaltyCustomer = z.infer<typeof insertLoyaltyCustomerSchema>;
export type LoyaltyCustomer = typeof loyaltyCustomersTable.$inferSelect;
