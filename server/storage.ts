import { type Client, type Quote, type FollowUp, type InsertClient, type InsertQuote, type InsertFollowUp, type QuoteWithClient, type InsertUser, type User, clients, quotes, followUps, users } from "@shared/schema";
import { randomUUID } from "crypto";
import { getDb, withSafeDelete } from "./db";
import { desc, eq, sql } from "drizzle-orm";

export interface IStorage {
  // Clients
  getClients(search?: string): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, client: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: string): Promise<boolean>;
  deleteClientWithData(id: string): Promise<boolean>; // Transactional cascade deletion with verification

  // Quotes
  getQuotes(filters?: { status?: string; clientId?: string }): Promise<QuoteWithClient[]>;
  getQuote(id: string): Promise<Quote | undefined>;
  createQuote(quote: InsertQuote): Promise<Quote>;
  updateQuote(id: string, quote: Partial<InsertQuote>): Promise<Quote | undefined>;
  deleteQuote(id: string): Promise<boolean>;
  getQuotesByClientId(clientId: string): Promise<Quote[]>;

  // Follow-ups
  getFollowUps(quoteId: string): Promise<FollowUp[]>;
  createFollowUp(followUp: InsertFollowUp): Promise<FollowUp>;
  getPendingFollowUps(): Promise<QuoteWithClient[]>;

  // Statistics
  getQuoteStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    conversionRate: number;
    averageAmount: number;
    monthlyRevenue: { month: string; amount: number }[];
  }>;

  // Users
  createUser(user: InsertUser & { passwordHash: string }): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
}

export class MemStorage implements IStorage {
  private clients: Map<string, Client>;
  private quotes: Map<string, Quote>;
  private followUps: Map<string, FollowUp>;
  private users: Map<string, User>;

  constructor() {
    this.clients = new Map();
    this.quotes = new Map();
    this.followUps = new Map();
    this.users = new Map();
  }

  async getClients(search?: string): Promise<Client[]> {
    const allClients = Array.from(this.clients.values());
    
    if (!search) {
      return allClients.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    const searchLower = search.toLowerCase();
    return allClients.filter(client => 
      client.name.toLowerCase().includes(searchLower) ||
      client.company.toLowerCase().includes(searchLower) ||
      client.email.toLowerCase().includes(searchLower)
    ).sort((a, b) => a.name.localeCompare(b.name));
  }

  async getClient(id: string): Promise<Client | undefined> {
    return this.clients.get(id);
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    const id = randomUUID();
    const client: Client = { 
      ...insertClient, 
      id, 
      phone: insertClient.phone || null,
      position: insertClient.position || null,
      createdAt: new Date() 
    };
    this.clients.set(id, client);
    return client;
  }

  async updateClient(id: string, updates: Partial<InsertClient>): Promise<Client | undefined> {
    const client = this.clients.get(id);
    if (!client) return undefined;

    const updatedClient: Client = { ...client, ...updates };
    this.clients.set(id, updatedClient);
    return updatedClient;
  }

  async deleteClient(id: string): Promise<boolean> {
    // Delete all quotes for this client first
    const clientQuotes = Array.from(this.quotes.values()).filter(q => q.clientId === id);
    clientQuotes.forEach(quote => {
      this.quotes.delete(quote.id);
      // Delete follow-ups for these quotes
      Array.from(this.followUps.values())
        .filter(f => f.quoteId === quote.id)
        .forEach(f => this.followUps.delete(f.id));
    });
    
    return this.clients.delete(id);
  }

  async deleteClientWithData(id: string): Promise<boolean> {
    // For in-memory storage, this is the same as deleteClient
    return this.deleteClient(id);
  }

  async getQuotes(filters?: { status?: string; clientId?: string }): Promise<QuoteWithClient[]> {
    const allQuotes = Array.from(this.quotes.values());
    
    let filteredQuotes = allQuotes;
    
    if (filters?.status && filters.status !== "Tous les statuts") {
      filteredQuotes = filteredQuotes.filter(quote => quote.status === filters.status);
    }
    
    if (filters?.clientId) {
      filteredQuotes = filteredQuotes.filter(quote => quote.clientId === filters.clientId);
    }

    // Add client data to each quote
    const quotesWithClients: QuoteWithClient[] = [];
    for (const quote of filteredQuotes) {
      const client = this.clients.get(quote.clientId);
      if (client) {
        quotesWithClients.push({ ...quote, client });
      }
    }

    return quotesWithClients.sort((a, b) => new Date(b.sentDate).getTime() - new Date(a.sentDate).getTime());
  }

  async getQuote(id: string): Promise<Quote | undefined> {
    return this.quotes.get(id);
  }

  async createQuote(insertQuote: InsertQuote): Promise<Quote> {
    const id = randomUUID();
    const quote: Quote = { 
      ...insertQuote, 
      id, 
      status: insertQuote.status || "Envoyé",
      notes: insertQuote.notes || null,
      lastFollowUpDate: insertQuote.lastFollowUpDate || null,
      plannedFollowUpDate: insertQuote.plannedFollowUpDate || null,
      acceptedAt: (insertQuote as any).acceptedAt || null,
      createdAt: new Date() 
    };
    this.quotes.set(id, quote);
    return quote;
  }

  async updateQuote(id: string, updates: Partial<InsertQuote>): Promise<Quote | undefined> {
    const quote = this.quotes.get(id);
    if (!quote) return undefined;

    let finalUpdates: any = { ...updates };
    if (updates.status === "Accepté" && (quote as any).acceptedAt == null && (updates as any).acceptedAt == null) {
      finalUpdates.acceptedAt = new Date() as any;
    }
    const updatedQuote: Quote = { ...quote, ...finalUpdates };
    this.quotes.set(id, updatedQuote);
    return updatedQuote;
  }

  async deleteQuote(id: string): Promise<boolean> {
    // Delete all follow-ups for this quote first
    Array.from(this.followUps.values())
      .filter(f => f.quoteId === id)
      .forEach(f => this.followUps.delete(f.id));
      
    return this.quotes.delete(id);
  }

  async getQuotesByClientId(clientId: string): Promise<Quote[]> {
    return Array.from(this.quotes.values()).filter(quote => quote.clientId === clientId);
  }

  async getFollowUps(quoteId: string): Promise<FollowUp[]> {
    return Array.from(this.followUps.values())
      .filter(followUp => followUp.quoteId === quoteId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async createFollowUp(insertFollowUp: InsertFollowUp): Promise<FollowUp> {
    const id = randomUUID();
    const followUp: FollowUp = { 
      ...insertFollowUp, 
      id, 
      comment: insertFollowUp.comment || null,
      createdAt: new Date() 
    };
    this.followUps.set(id, followUp);
    
    // Update quote status and last follow-up date
    const quote = this.quotes.get(insertFollowUp.quoteId);
    if (quote) {
      const updatedQuote = { 
        ...quote, 
        status: "Relancé" as const,
        lastFollowUpDate: insertFollowUp.date 
      };
      this.quotes.set(quote.id, updatedQuote);
    }
    
    return followUp;
  }

  async getPendingFollowUps(): Promise<QuoteWithClient[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset to start of day

    const pendingQuotes = Array.from(this.quotes.values()).filter(quote => {
      if (quote.status === "Accepté" || quote.status === "Refusé") {
        return false;
      }

      // Use planned follow-up date if available, otherwise fallback to 7 days after last follow-up
      if (quote.plannedFollowUpDate) {
        const plannedDate = new Date(quote.plannedFollowUpDate);
        plannedDate.setHours(0, 0, 0, 0);
        return plannedDate <= today;
      }

      // Fallback to old logic if no planned date
      const lastFollowUp = quote.lastFollowUpDate ? new Date(quote.lastFollowUpDate) : new Date(quote.sentDate);
      const daysSinceLastFollowUp = Math.floor((today.getTime() - lastFollowUp.getTime()) / (1000 * 60 * 60 * 24));
      
      return daysSinceLastFollowUp >= 7;
    });

    // Add client data
    const pendingWithClients: QuoteWithClient[] = [];
    for (const quote of pendingQuotes) {
      const client = this.clients.get(quote.clientId);
      if (client) {
        pendingWithClients.push({ ...quote, client });
      }
    }

    return pendingWithClients;
  }

  async getQuoteStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    conversionRate: number;
    averageAmount: number;
    monthlyRevenue: { month: string; amount: number }[];
  }> {
    const allQuotes = Array.from(this.quotes.values());
    
    const byStatus: Record<string, number> = {
      "Envoyé": 0,
      "En attente": 0,
      "Relancé": 0,
      "Accepté": 0,
      "Refusé": 0,
    };

    let totalAmount = 0;
    let acceptedAmount = 0;

    for (const quote of allQuotes) {
      byStatus[quote.status]++;
      const amount = parseFloat(quote.amount);
      totalAmount += amount;
      if (quote.status === "Accepté") {
        acceptedAmount += amount;
      }
    }

    const conversionRate = allQuotes.length > 0 ? (byStatus["Accepté"] / allQuotes.length) * 100 : 0;
    const averageAmount = allQuotes.length > 0 ? totalAmount / allQuotes.length : 0;

    // Calculate real monthly revenue from quotes
    const monthlyRevenue = this.calculateMonthlyRevenue(allQuotes);

    return {
      total: allQuotes.length,
      byStatus,
      conversionRate,
      averageAmount,
      monthlyRevenue,
    };
  }

  private calculateMonthlyRevenue(quotes: Quote[]): { month: string; amount: number }[] {
    const monthlyData: { [key: string]: number } = {};
    
    // Get last 6 months dynamically
    const now = new Date();
    const months = [];
    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = monthNames[date.getMonth()];
      months.push(monthName);
      monthlyData[monthName] = 0;
    }

    // Calculate revenue from accepted quotes, based on acceptance date when available
    quotes.forEach(quote => {
      if (quote.status === "Accepté") {
        const baseDate = quote.acceptedAt ? new Date(quote.acceptedAt as any) : new Date(quote.sentDate);
        const monthName = monthNames[baseDate.getMonth()];
        if (monthName && Object.prototype.hasOwnProperty.call(monthlyData, monthName)) {
          monthlyData[monthName] += parseFloat(quote.amount);
        }
      }
    });

    return months.map(month => ({
      month,
      amount: monthlyData[month]
    }));
  }

  async createUser(user: InsertUser & { passwordHash: string }): Promise<User> {
    const id = randomUUID();
    const created: User = {
      id,
      name: user.name,
      email: user.email,
      passwordHash: user.passwordHash,
      role: (user.role as any) || "sales",
      createdAt: new Date(),
    } as any;
    this.users.set(id, created);
    return created;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const all = Array.from(this.users.values());
    return all.find((u) => u.email === email);
  }
}

const memFallback = new MemStorage();

class SqlStorage implements IStorage {
  async getClients(search?: string): Promise<Client[]> {
    const db = getDb();
    if (!db) return memFallback.getClients(search);
    if (search && search.trim()) {
      const term = `%${search.toLowerCase()}%`;
      const rows = await db
        .select()
        .from(clients)
        .where(sql`lower(${clients.name}) like ${term} or lower(${clients.company}) like ${term} or lower(${clients.email}) like ${term}`)
        .orderBy(clients.name);
      return rows as Client[];
    }
    const rows = await db.select().from(clients).orderBy(clients.name);
    return rows as Client[];
  }

  async getClient(id: string): Promise<Client | undefined> {
    const db = getDb();
    if (!db) return memFallback.getClient(id);
    const [row] = await db.select().from(clients).where(eq(clients.id, id));
    return row as Client | undefined;
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    const db = getDb();
    if (!db) return memFallback.createClient(insertClient);
    const [row] = await db.insert(clients).values(insertClient).returning();
    return row as Client;
  }

  async updateClient(id: string, updates: Partial<InsertClient>): Promise<Client | undefined> {
    const db = getDb();
    if (!db) return memFallback.updateClient(id, updates);
    const [row] = await db.update(clients).set(updates).where(eq(clients.id, id)).returning();
    return row as Client | undefined;
  }

  async deleteClient(id: string): Promise<boolean> {
    const db = getDb();
    if (!db) return memFallback.deleteClient(id);
    
    // Use safe delete with cascade constraints for data integrity
    try {
      return await withSafeDelete(db, async (db) => {
        // Check if client exists before deletion
        const [existingClient] = await db.select().from(clients).where(eq(clients.id, id));
        if (!existingClient) {
          return false;
        }
        
        // Delete client - cascade constraints will handle quotes and follow-ups automatically
        // This is atomic at the database level due to foreign key constraints
        await db.delete(clients).where(eq(clients.id, id));
        return true;
      });
    } catch (error) {
      // Log error for debugging but return false to indicate failure
      console.error('Error deleting client:', error);
      return false;
    }
  }

  async deleteClientWithData(id: string): Promise<boolean> {
    const db = getDb();
    if (!db) return memFallback.deleteClientWithData(id);
    
    // Enhanced safe deletion with verification and logging
    try {
      return await withSafeDelete(db, async (db) => {
        // Check if client exists and get related data counts for logging
        const [existingClient] = await db.select().from(clients).where(eq(clients.id, id));
        if (!existingClient) {
          return false;
        }
        
        // Get counts for audit logging (optional)
        const clientQuotes = await db.select({ id: quotes.id }).from(quotes).where(eq(quotes.clientId, id));
        const quoteIds = clientQuotes.map(q => q.id);
        
        let followUpCount = 0;
        if (quoteIds.length > 0) {
          const followUpCounts = await db.select({ count: sql<number>`count(*)` }).from(followUps).where(sql`${followUps.quoteId} = ANY(${quoteIds})`);
          followUpCount = followUpCounts[0]?.count || 0;
        }
        
        // Log the cascade deletion for audit purposes
        console.log(`Deleting client ${id} with ${clientQuotes.length} quotes and ${followUpCount} follow-ups`);
        
        // Delete client - cascade constraints ensure all related data is deleted atomically
        await db.delete(clients).where(eq(clients.id, id));
        return true;
      });
    } catch (error) {
      console.error('Error deleting client with data:', error);
      return false;
    }
  }

  async getQuotes(filters?: { status?: string; clientId?: string }): Promise<QuoteWithClient[]> {
    const db = getDb();
    if (!db) return memFallback.getQuotes(filters);
    let rows = (await db.select().from(quotes).orderBy(desc(quotes.sentDate))) as Quote[];
    if (filters?.status && filters.status !== "Tous les statuts") {
      rows = rows.filter((q) => q.status === filters.status);
    }
    if (filters?.clientId) {
      rows = rows.filter((q) => q.clientId === filters.clientId);
    }
    const clientIds = Array.from(new Set(rows.map((r) => r.clientId)));
    const clientsRows = clientIds.length
      ? ((await db.select().from(clients).where(sql`${clients.id} in (${sql.join(clientIds, sql`,`)})`)) as Client[])
      : [];
    const map = new Map<string, Client>();
    clientsRows.forEach((c) => map.set((c as any).id, c));
    return rows
      .map((q) => ({ ...(q as any), client: map.get(q.clientId)! }))
      .filter((q) => q.client);
  }

  async getQuote(id: string): Promise<Quote | undefined> {
    const db = getDb();
    if (!db) return memFallback.getQuote(id);
    const [row] = await db.select().from(quotes).where(eq(quotes.id, id));
    return row as Quote | undefined;
  }

  async createQuote(insertQuote: InsertQuote): Promise<Quote> {
    const db = getDb();
    if (!db) return memFallback.createQuote(insertQuote);
    const [row] = await db.insert(quotes).values(insertQuote).returning();
    return row as Quote;
  }

  async updateQuote(id: string, updates: Partial<InsertQuote>): Promise<Quote | undefined> {
    const db = getDb();
    if (!db) return memFallback.updateQuote(id, updates);
    const computed: any = { ...updates };
    if (updates.status === "Accepté" && (updates as any).acceptedAt == null) {
      computed.acceptedAt = new Date() as any;
    }
    const [row] = await db.update(quotes).set(computed).where(eq(quotes.id, id)).returning();
    return row as Quote | undefined;
  }

  async deleteQuote(id: string): Promise<boolean> {
    const db = getDb();
    if (!db) return memFallback.deleteQuote(id);
    
    // Use safe delete with cascade constraints for data integrity
    try {
      return await withSafeDelete(db, async (db) => {
        // Check if quote exists before deletion
        const [existingQuote] = await db.select().from(quotes).where(eq(quotes.id, id));
        if (!existingQuote) {
          return false;
        }
        
        // Delete quote - cascade constraints will handle follow-ups automatically
        // This is atomic at the database level due to foreign key constraints
        await db.delete(quotes).where(eq(quotes.id, id));
        return true;
      });
    } catch (error) {
      // Log error for debugging but return false to indicate failure
      console.error('Error deleting quote:', error);
      return false;
    }
  }

  async getQuotesByClientId(clientId: string): Promise<Quote[]> {
    const db = getDb();
    if (!db) return memFallback.getQuotesByClientId(clientId);
    const rows = await db.select().from(quotes).where(eq(quotes.clientId, clientId));
    return rows as Quote[];
  }

  async getFollowUps(quoteId: string): Promise<FollowUp[]> {
    const db = getDb();
    if (!db) return memFallback.getFollowUps(quoteId);
    const rows = await db.select().from(followUps).where(eq(followUps.quoteId, quoteId)).orderBy(desc(followUps.date));
    return rows as FollowUp[];
  }

  async createFollowUp(insertFollowUp: InsertFollowUp): Promise<FollowUp> {
    const db = getDb();
    if (!db) return memFallback.createFollowUp(insertFollowUp);
    const [row] = await db.insert(followUps).values(insertFollowUp).returning();
    await db.update(quotes).set({ status: "Relancé", lastFollowUpDate: insertFollowUp.date }).where(eq(quotes.id, insertFollowUp.quoteId));
    return row as FollowUp;
  }

  async getPendingFollowUps(): Promise<QuoteWithClient[]> {
    const db = getDb();
    if (!db) return memFallback.getPendingFollowUps();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const all = (await db.select().from(quotes)) as Quote[];
    const pending = all.filter((quote) => {
      if (quote.status === "Accepté" || quote.status === "Refusé") return false;
      if (quote.plannedFollowUpDate) {
        const planned = new Date(quote.plannedFollowUpDate);
        planned.setHours(0, 0, 0, 0);
        return planned <= today;
      }
      const last = quote.lastFollowUpDate ? new Date(quote.lastFollowUpDate) : new Date(quote.sentDate);
      const days = Math.floor((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
      return days >= 7;
    });
    const clientIds = Array.from(new Set(pending.map((p) => p.clientId)));
    const clientsRows = clientIds.length
      ? ((await db.select().from(clients).where(sql`${clients.id} in (${sql.join(clientIds, sql`,`)})`)) as Client[])
      : [];
    const map = new Map<string, Client>();
    clientsRows.forEach((c) => map.set((c as any).id, c));
    return pending
      .map((q) => ({ ...(q as any), client: map.get(q.clientId)! }))
      .filter((q) => q.client);
  }

  async getQuoteStats(): Promise<{ total: number; byStatus: Record<string, number>; conversionRate: number; averageAmount: number; monthlyRevenue: { month: string; amount: number }[]; }> {
    const db = getDb();
    if (!db) return memFallback.getQuoteStats();
    const allQuotes = (await db.select().from(quotes)) as Quote[];
    const byStatus: Record<string, number> = { "Envoyé": 0, "En attente": 0, "Relancé": 0, "Accepté": 0, "Refusé": 0 };
    let totalAmount = 0;
    let acceptedAmount = 0;
    for (const q of allQuotes) {
      byStatus[q.status] = (byStatus[q.status] || 0) + 1;
      const amount = parseFloat(q.amount);
      totalAmount += amount;
      if (q.status === "Accepté") acceptedAmount += amount;
    }
    const conversionRate = allQuotes.length > 0 ? (byStatus["Accepté"] / allQuotes.length) * 100 : 0;
    const averageAmount = allQuotes.length > 0 ? totalAmount / allQuotes.length : 0;
    // compute last 6 months revenue for accepted quotes
    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    const now = new Date();
    const months: string[] = [];
    const monthlyData: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const name = monthNames[d.getMonth()];
      months.push(name);
      monthlyData[name] = 0;
    }
    allQuotes.forEach((q) => {
      if (q.status === "Accepté") {
        const d = new Date((q as any).acceptedAt || q.sentDate);
        const name = monthNames[d.getMonth()];
        if (name in monthlyData) monthlyData[name] += parseFloat(q.amount);
      }
    });
    const monthlyRevenue = months.map((m) => ({ month: m, amount: monthlyData[m] }));
    return { total: allQuotes.length, byStatus, conversionRate, averageAmount, monthlyRevenue };
  }

  async createUser(user: InsertUser & { passwordHash: string }): Promise<User> {
    const db = getDb();
    if (!db) return memFallback.createUser(user);
    const [row] = await db
      .insert(users)
      .values({ name: user.name, email: user.email, passwordHash: user.passwordHash, role: (user.role as any) || "sales" })
      .returning();
    return row as User;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const db = getDb();
    if (!db) return memFallback.getUserByEmail(email);
    const [row] = await db.select().from(users).where(eq(users.email, email));
    return row as User | undefined;
  }
}

export const storage: IStorage = new SqlStorage();
