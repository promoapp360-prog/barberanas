import { createInsertSchema } from "drizzle-zod";
import { boolean, date, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const loyaltyPromosTable = pgTable("loyalty_promos", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  emoji: text("emoji").notNull().default("✂️"),
  goal: integer("goal"),
  reward: text("reward").notNull().default(""),
  description: text("description").notNull().default(""),
  active: boolean("active").notNull().default(true),
  endsAt: date("ends_at", { mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLoyaltyPromoSchema = createInsertSchema(loyaltyPromosTable).omit({
  id: true,
  createdAt: true,
});
export type InsertLoyaltyPromo = z.infer<typeof insertLoyaltyPromoSchema>;
export type LoyaltyPromo = typeof loyaltyPromosTable.$inferSelect;
