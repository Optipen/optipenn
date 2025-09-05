import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  company: text("company").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  position: text("position"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const quotes = pgTable("quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reference: text("reference").notNull().unique(),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  sentDate: date("sent_date").notNull(),
  status: text("status", { enum: ["Envoyé", "En attente", "Relancé", "Accepté", "Refusé"] }).notNull().default("Envoyé"),
  notes: text("notes"),
  lastFollowUpDate: date("last_follow_up_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const followUps = pgTable("follow_ups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
});

export const insertQuoteSchema = createInsertSchema(quotes).omit({
  id: true,
  createdAt: true,
});

export const insertFollowUpSchema = createInsertSchema(followUps).omit({
  id: true,
  createdAt: true,
});

export type InsertClient = z.infer<typeof insertClientSchema>;
export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type InsertFollowUp = z.infer<typeof insertFollowUpSchema>;

export type Client = typeof clients.$inferSelect;
export type Quote = typeof quotes.$inferSelect;
export type FollowUp = typeof followUps.$inferSelect;

export type QuoteWithClient = Quote & {
  client: Client;
};
