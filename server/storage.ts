import { type Client, type Quote, type FollowUp, type InsertClient, type InsertQuote, type InsertFollowUp, type QuoteWithClient, type InsertUser, type User, clients, quotes, followUps, users } from "@shared/schema";
import { randomUUID } from "crypto";
import { getDb, withSafeDelete } from "./db";
import { desc, eq, sql, and, like, or, ilike, count, avg, sum } from "drizzle-orm";
import { logger } from "./logger";
import { metrics } from "./metrics";

export interface IStorage {
  // Clients
  getClients(search?: string, page?: number, pageSize?: number): Promise<{ clients: Client[]; total: number }>;
  getClient(id: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, client: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: string): Promise<boolean>;
  deleteClientWithData(id: string): Promise<boolean>; // Transactional cascade deletion with verification
  searchClients(query: string): Promise<Client[]>;

  // Quotes
  getQuotes(filters?: { status?: string; clientId?: string }, page?: number, pageSize?: number): Promise<{ quotes: QuoteWithClient[]; total: number }>;
  getQuote(id: string): Promise<Quote | undefined>;
  createQuote(quote: InsertQuote): Promise<Quote>;
  updateQuote(id: string, quote: Partial<InsertQuote>): Promise<Quote | undefined>;
  deleteQuote(id: string): Promise<boolean>;
  getQuotesByClientId(clientId: string): Promise<Quote[]>;
  searchQuotes(query: string): Promise<QuoteWithClient[]>;

  // Follow-ups
  getFollowUps(quoteId: string): Promise<FollowUp[]>;
  createFollowUp(followUp: InsertFollowUp): Promise<FollowUp>;
  getPendingFollowUps(page?: number, pageSize?: number): Promise<{ followUps: QuoteWithClient[]; total: number }>;

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

  async getClients(search?: string, page: number = 1, pageSize: number = 10): Promise<{ clients: Client[]; total: number }> {
    const allClients = Array.from(this.clients.values());
    
    let filteredClients = allClients;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredClients = allClients.filter(client => 
        client.name.toLowerCase().includes(searchLower) ||
        client.company.toLowerCase().includes(searchLower) ||
        client.email.toLowerCase().includes(searchLower)
      );
    }
    
    filteredClients.sort((a, b) => a.name.localeCompare(b.name));
    
    const total = filteredClients.length;
    const start = (page - 1) * pageSize;
    const clients = filteredClients.slice(start, start + pageSize);
    
    return { clients, total };
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

  async getQuotes(filters?: { status?: string; clientId?: string }, page: number = 1, pageSize: number = 10): Promise<{ quotes: QuoteWithClient[]; total: number }> {
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

    const sortedQuotes = quotesWithClients.sort((a, b) => new Date(b.sentDate).getTime() - new Date(a.sentDate).getTime());
    
    const total = sortedQuotes.length;
    const start = (page - 1) * pageSize;
    const quotes = sortedQuotes.slice(start, start + pageSize);

    return { quotes, total };
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

  async getPendingFollowUps(page: number = 1, pageSize: number = 10): Promise<{ followUps: QuoteWithClient[]; total: number }> {
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

    const total = pendingWithClients.length;
    const start = (page - 1) * pageSize;
    const followUps = pendingWithClients.slice(start, start + pageSize);

    return { followUps, total };
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

  async searchClients(query: string): Promise<Client[]> {
    const searchLower = query.toLowerCase();
    return Array.from(this.clients.values()).filter(client =>
      client.name.toLowerCase().includes(searchLower) ||
      client.company.toLowerCase().includes(searchLower) ||
      client.email.toLowerCase().includes(searchLower)
    ).slice(0, 10);
  }

  async searchQuotes(query: string): Promise<QuoteWithClient[]> {
    const searchLower = query.toLowerCase();
    return Array.from(this.quotes.values())
      .filter(quote =>
        quote.reference.toLowerCase().includes(searchLower) ||
        quote.description.toLowerCase().includes(searchLower)
      )
      .map(quote => {
        const client = this.clients.get(quote.clientId);
        return { ...quote, client } as QuoteWithClient;
      })
      .filter(quote => quote.client) // Only include quotes with valid clients
      .slice(0, 10);
  }
}

const memFallback = new MemStorage();

class SqlStorage implements IStorage {
  async getClients(search?: string, page: number = 1, pageSize: number = 10): Promise<{ clients: Client[]; total: number }> {
    const startTime = Date.now();
    const db = getDb();
    if (!db) return memFallback.getClients(search, page, pageSize);
    
    try {
      let whereCondition;
      if (search && search.trim()) {
        const term = `%${search.toLowerCase()}%`;
        whereCondition = or(
          ilike(clients.name, term),
          ilike(clients.company, term), 
          ilike(clients.email, term)
        );
      }

      // Get total count
      const [totalResult] = await db
        .select({ count: count() })
        .from(clients)
        .where(whereCondition);
      const total = totalResult.count as number;

      // Get paginated results
      const offset = (page - 1) * pageSize;
      const rows = await db
        .select()
        .from(clients)
        .where(whereCondition)
        .orderBy(clients.name)
        .limit(pageSize)
        .offset(offset);

      const duration = Date.now() - startTime;
      logger.logPerformance("getClients", duration, { search, page, pageSize, total });
      metrics.recordSlowQuery("getClients", duration);

      return { clients: rows as Client[], total };
    } catch (error) {
      logger.error("Error fetching clients", { search, page, pageSize }, error as Error);
      return memFallback.getClients(search, page, pageSize);
    }
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

  async getQuotes(filters?: { status?: string; clientId?: string }, page: number = 1, pageSize: number = 10): Promise<{ quotes: QuoteWithClient[]; total: number }> {
    const startTime = Date.now();
    const db = getDb();
    if (!db) return memFallback.getQuotes(filters, page, pageSize);
    
    try {
      // Build where conditions
      const conditions = [];
      if (filters?.status && filters.status !== "Tous les statuts") {
        conditions.push(eq(quotes.status, filters.status as any));
      }
      if (filters?.clientId) {
        conditions.push(eq(quotes.clientId, filters.clientId));
      }
      
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Get total count with filter
      const [totalResult] = await db
        .select({ count: count() })
        .from(quotes)
        .where(whereClause);
      const total = totalResult.count as number;

      // Get paginated results with JOIN to prevent N+1 queries
      const offset = (page - 1) * pageSize;
      const rows = await db
        .select({
          // Quote fields
          id: quotes.id,
          reference: quotes.reference,
          clientId: quotes.clientId,
          description: quotes.description,
          amount: quotes.amount,
          sentDate: quotes.sentDate,
          status: quotes.status,
          notes: quotes.notes,
          lastFollowUpDate: quotes.lastFollowUpDate,
          plannedFollowUpDate: quotes.plannedFollowUpDate,
          acceptedAt: quotes.acceptedAt,
          createdAt: quotes.createdAt,
          // Client fields
          clientName: clients.name,
          clientCompany: clients.company,
          clientEmail: clients.email,
          clientPhone: clients.phone,
          clientPosition: clients.position,
          clientCreatedAt: clients.createdAt,
        })
        .from(quotes)
        .innerJoin(clients, eq(quotes.clientId, clients.id))
        .where(whereClause)
        .orderBy(desc(quotes.sentDate))
        .limit(pageSize)
        .offset(offset);

      // Transform to QuoteWithClient format
      const quotesWithClients: QuoteWithClient[] = rows.map(row => ({
        id: row.id,
        reference: row.reference,
        clientId: row.clientId,
        description: row.description,
        amount: row.amount,
        sentDate: row.sentDate,
        status: row.status,
        notes: row.notes,
        lastFollowUpDate: row.lastFollowUpDate,
        plannedFollowUpDate: row.plannedFollowUpDate,
        acceptedAt: row.acceptedAt,
        createdAt: row.createdAt,
        client: {
          id: row.clientId,
          name: row.clientName,
          company: row.clientCompany,
          email: row.clientEmail,
          phone: row.clientPhone,
          position: row.clientPosition,
          createdAt: row.clientCreatedAt,
        }
      }));

      const duration = Date.now() - startTime;
      logger.logPerformance("getQuotes", duration, { filters, page, pageSize, total });
      metrics.recordSlowQuery("getQuotes", duration);

      return { quotes: quotesWithClients, total };
    } catch (error) {
      logger.error("Error fetching quotes", { filters, page, pageSize }, error as Error);
      return memFallback.getQuotes(filters, page, pageSize);
    }
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

  async getPendingFollowUps(page: number = 1, pageSize: number = 10): Promise<{ followUps: QuoteWithClient[]; total: number }> {
    const startTime = Date.now();
    const db = getDb();
    if (!db) return memFallback.getPendingFollowUps(page, pageSize);
    
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];

      // Complex query with proper joins and filtering - done at database level
      const allPendingRows = await db
        .select({
          // Quote fields
          id: quotes.id,
          reference: quotes.reference,
          clientId: quotes.clientId,
          description: quotes.description,
          amount: quotes.amount,
          sentDate: quotes.sentDate,
          status: quotes.status,
          notes: quotes.notes,
          lastFollowUpDate: quotes.lastFollowUpDate,
          plannedFollowUpDate: quotes.plannedFollowUpDate,
          acceptedAt: quotes.acceptedAt,
          createdAt: quotes.createdAt,
          // Client fields
          clientName: clients.name,
          clientCompany: clients.company,
          clientEmail: clients.email,
          clientPhone: clients.phone,
          clientPosition: clients.position,
          clientCreatedAt: clients.createdAt,
        })
        .from(quotes)
        .innerJoin(clients, eq(quotes.clientId, clients.id))
        .where(
          and(
            // Not in final status
            sql`${quotes.status} NOT IN ('Accepté', 'Refusé')`,
            // Either planned date is due OR 7+ days since last follow-up
            or(
              sql`${quotes.plannedFollowUpDate} <= ${todayStr}`,
              and(
                sql`${quotes.plannedFollowUpDate} IS NULL`,
                sql`COALESCE(${quotes.lastFollowUpDate}, ${quotes.sentDate}) <= ${todayStr} - INTERVAL '7 days'`
              )
            )
          )
        );

      // Transform to QuoteWithClient format
      const pendingFollowUps: QuoteWithClient[] = allPendingRows.map(row => ({
        id: row.id,
        reference: row.reference,
        clientId: row.clientId,
        description: row.description,
        amount: row.amount,
        sentDate: row.sentDate,
        status: row.status,
        notes: row.notes,
        lastFollowUpDate: row.lastFollowUpDate,
        plannedFollowUpDate: row.plannedFollowUpDate,
        acceptedAt: row.acceptedAt,
        createdAt: row.createdAt,
        client: {
          id: row.clientId,
          name: row.clientName,
          company: row.clientCompany,
          email: row.clientEmail,
          phone: row.clientPhone,
          position: row.clientPosition,
          createdAt: row.clientCreatedAt,
        }
      }));

      const total = pendingFollowUps.length;
      const start = (page - 1) * pageSize;
      const followUps = pendingFollowUps.slice(start, start + pageSize);

      const duration = Date.now() - startTime;
      logger.logPerformance("getPendingFollowUps", duration, { page, pageSize, total });
      metrics.recordSlowQuery("getPendingFollowUps", duration);

      return { followUps, total };
    } catch (error) {
      logger.error("Error fetching pending follow-ups", { page, pageSize }, error as Error);
      return memFallback.getPendingFollowUps(page, pageSize);
    }
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

  async searchClients(query: string): Promise<Client[]> {
    const startTime = Date.now();
    const db = getDb();
    if (!db) return memFallback.searchClients(query);

    try {
      const term = `%${query.toLowerCase()}%`;
      const rows = await db
        .select()
        .from(clients)
        .where(
          or(
            ilike(clients.name, term),
            ilike(clients.company, term),
            ilike(clients.email, term)
          )
        )
        .limit(10);

      const duration = Date.now() - startTime;
      metrics.recordRequest(200, duration);
      logger.logPerformance("searchClients", duration, { query: query.slice(0, 20), count: rows.length });

      return rows as Client[];
    } catch (error) {
      logger.error("Error searching clients", {}, error as Error);
      return memFallback.searchClients(query);
    }
  }

  async searchQuotes(query: string): Promise<QuoteWithClient[]> {
    const startTime = Date.now();
    const db = getDb();
    if (!db) return memFallback.searchQuotes(query);

    try {
      const term = `%${query.toLowerCase()}%`;
      const rows = await db
        .select({
          id: quotes.id,
          reference: quotes.reference,
          description: quotes.description,
          amount: quotes.amount,
          status: quotes.status,
          sentDate: quotes.sentDate,
          clientId: quotes.clientId,
          createdAt: quotes.createdAt,
          client: {
            id: clients.id,
            name: clients.name,
            email: clients.email,
            company: clients.company,
            phone: clients.phone,
            position: clients.position,
            createdAt: clients.createdAt,
          },
        })
        .from(quotes)
        .leftJoin(clients, eq(quotes.clientId, clients.id))
        .where(
          or(
            ilike(quotes.reference, term),
            ilike(quotes.description, term),
            ilike(clients.name, term),
            ilike(clients.company, term)
          )
        )
        .limit(10);

      const duration = Date.now() - startTime;
      metrics.recordRequest(200, duration);
      logger.logPerformance("searchQuotes", duration, { query: query.slice(0, 20), count: rows.length });

      return rows.map(row => ({
        ...row,
        client: row.client || undefined,
      })) as QuoteWithClient[];
    } catch (error) {
      logger.error("Error searching quotes", {}, error as Error);
      return memFallback.searchQuotes(query);
    }
  }
}

export const storage: IStorage = new SqlStorage();
