import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { 
  strictEmailValidation, 
  strictAmountValidation, 
  strictDateValidation, 
  optionalStrictDateValidation,
  pastDateValidation
} from "./validation-utils";

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
  plannedFollowUpDate: date("planned_follow_up_date"),
  acceptedAt: date("accepted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const followUps = pgTable("follow_ups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Users and roles
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "manager", "sales"] }).notNull().default("sales"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
}).extend({
  name: z.string().min(1, "Le nom est requis"),
  company: z.string().min(1, "L'entreprise est requise"),
  email: strictEmailValidation,
  phone: z.string().optional(),
  position: z.string().optional(),
});

export const insertQuoteSchema = createInsertSchema(quotes).omit({
  id: true,
  createdAt: true,
}).extend({
  reference: z.string().min(1, "La référence est requise"),
  clientId: z.string().min(1, "Le client est requis"),
  description: z.string().min(1, "La description est requise"),
  amount: strictAmountValidation,
  sentDate: pastDateValidation,
  notes: z.string().optional(),
  plannedFollowUpDate: optionalStrictDateValidation,
  acceptedAt: optionalStrictDateValidation,
});

export const insertFollowUpSchema = createInsertSchema(followUps).omit({
  id: true,
  createdAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  passwordHash: true,
}).extend({
  name: z.string().min(1, "Le nom est requis"),
  email: strictEmailValidation,
  password: z.string().min(8, "Mot de passe trop court (min 8)")
    .regex(/[A-Z]/, "Doit contenir une majuscule")
    .regex(/[a-z]/, "Doit contenir une minuscule")
    .regex(/[0-9]/, "Doit contenir un chiffre"),
  role: z.enum(["admin", "manager", "sales"]).optional(),
});

export type InsertClient = z.infer<typeof insertClientSchema>;
export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type InsertFollowUp = z.infer<typeof insertFollowUpSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Client = typeof clients.$inferSelect;
export type Quote = typeof quotes.$inferSelect;
export type FollowUp = typeof followUps.$inferSelect;

export type QuoteWithClient = Quote & {
  client: Client;
};

export type User = typeof users.$inferSelect;
