import { type Client, type Quote, type FollowUp, type InsertClient, type InsertQuote, type InsertFollowUp, type QuoteWithClient } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Clients
  getClients(search?: string): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, client: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: string): Promise<boolean>;

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
}

export class MemStorage implements IStorage {
  private clients: Map<string, Client>;
  private quotes: Map<string, Quote>;
  private followUps: Map<string, FollowUp>;

  constructor() {
    this.clients = new Map();
    this.quotes = new Map();
    this.followUps = new Map();
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
      createdAt: new Date() 
    };
    this.quotes.set(id, quote);
    return quote;
  }

  async updateQuote(id: string, updates: Partial<InsertQuote>): Promise<Quote | undefined> {
    const quote = this.quotes.get(id);
    if (!quote) return undefined;

    const updatedQuote: Quote = { ...quote, ...updates };
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
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    const pendingQuotes = Array.from(this.quotes.values()).filter(quote => {
      if (quote.status === "Accepté" || quote.status === "Refusé") {
        return false;
      }

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

    // Generate mock monthly revenue data
    const monthlyRevenue = [
      { month: "Jan", amount: 45000 },
      { month: "Fév", amount: 52000 },
      { month: "Mar", amount: 48000 },
      { month: "Avr", amount: 61000 },
      { month: "Mai", amount: 55000 },
      { month: "Jun", amount: acceptedAmount },
    ];

    return {
      total: allQuotes.length,
      byStatus,
      conversionRate,
      averageAmount,
      monthlyRevenue,
    };
  }
}

export const storage = new MemStorage();
