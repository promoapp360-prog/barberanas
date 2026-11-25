import { createInsertSchema } from "drizzle-zod";
import { index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { loyaltyCustomersTable } from "./loyalty-customers";
import { loyaltyPromosTable } from "./loyalty-promos";

export const loyaltyEventsTable = pgTable(
  "loyalty_events",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => loyaltyCustomersTable.id, { onDelete: "cascade" }),
    promoId: integer("promo_id").references(() => loyaltyPromosTable.id, {
      onDelete: "set null",
    }),
    type: text("type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("loyalty_events_customer_idx").on(table.customerId, table.createdAt)],
);

export const insertLoyaltyEventSchema = createInsertSchema(loyaltyEventsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertLoyaltyEvent = z.infer<typeof insertLoyaltyEventSchema>;
export type LoyaltyEvent = typeof loyaltyEventsTable.$inferSelect;
