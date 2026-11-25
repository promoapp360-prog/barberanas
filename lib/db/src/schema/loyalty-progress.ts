import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, primaryKey } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { loyaltyCustomersTable } from "./loyalty-customers";
import { loyaltyPromosTable } from "./loyalty-promos";

export const loyaltyProgressTable = pgTable(
  "loyalty_progress",
  {
    customerId: integer("customer_id")
      .notNull()
      .references(() => loyaltyCustomersTable.id, { onDelete: "cascade" }),
    promoId: integer("promo_id")
      .notNull()
      .references(() => loyaltyPromosTable.id, { onDelete: "cascade" }),
    stamps: integer("stamps").notNull().default(0),
    rewards: integer("rewards").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.customerId, table.promoId] })],
);

export const insertLoyaltyProgressSchema = createInsertSchema(loyaltyProgressTable);
export type InsertLoyaltyProgress = z.infer<typeof insertLoyaltyProgressSchema>;
export type LoyaltyProgress = typeof loyaltyProgressTable.$inferSelect;
