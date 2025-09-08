import { type Client, type Quote, type FollowUp, type User, type InsertClient, type InsertQuote, type InsertFollowUp } from "@shared/schema";
import { randomUUID } from "crypto";

/**
 * Generate demo user data for auto-login
 */
export function createDemoUser(): User {
  return {
    id: "demo-user",
    name: "Admin Demo",
    email: "admin@example.com",
    passwordHash: "", // Not used in demo mode
    role: "admin",
    createdAt: new Date(),
  };
}

/**
 * Generate sample clients with realistic data
 */
export function createDemoClients(): InsertClient[] {
  const clients: InsertClient[] = [
    {
      name: "Sophie Martin",
      company: "Tech Solutions SARL",
      email: "s.martin@techsolutions.fr",
      phone: "01.45.67.89.12",
      position: "Directrice Technique",
    },
    {
      name: "Laurent Dubois",
      company: "Innovation Corp",
      email: "l.dubois@innovation-corp.com",
      phone: "02.34.56.78.90",
      position: "Chef de Projet",
    },
    {
      name: "Marie Leroy",
      company: "Digital Agency",
      email: "marie.leroy@digital-agency.fr",
      phone: "03.67.89.12.34",
      position: "Responsable Marketing",
    },
    {
      name: "Pierre Bernard",
      company: "Consulting Plus",
      email: "p.bernard@consulting-plus.fr",
      phone: "04.78.90.12.35",
      position: "Directeur Général",
    },
    {
      name: "Camille Rousseau",
      company: "StartupTech",
      email: "c.rousseau@startuptech.io",
      phone: "05.89.01.23.45",
      position: "CTO",
    },
  ];

  return clients;
}

/**
 * Generate sample quotes linked to clients
 */
export function createDemoQuotes(clientIds: string[]): InsertQuote[] {
  const quotes: InsertQuote[] = [
    {
      reference: "DEV-2024-001",
      clientId: clientIds[0],
      description: "Développement application web e-commerce avec gestion des stocks",
      amount: "15000.00",
      sentDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: "Accepté",
      notes: "Client très satisfait, signature prévue fin de semaine",
      plannedFollowUpDate: undefined,
      acceptedAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    },
    {
      reference: "DEV-2024-002",
      clientId: clientIds[1],
      description: "Refonte complète du site vitrine avec CMS personnalisé",
      amount: "8500.00",
      sentDate: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: "En attente",
      notes: "Attendre retour après présentation au comité de direction",
      plannedFollowUpDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      acceptedAt: undefined,
    },
    {
      reference: "DEV-2024-003",
      clientId: clientIds[2],
      description: "Développement API REST et tableau de bord analytics",
      amount: "12000.00",
      sentDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: "Relancé",
      notes: "Première relance effectuée, client intéressé mais budget à valider",
      plannedFollowUpDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      acceptedAt: undefined,
    },
    {
      reference: "DEV-2024-004",
      clientId: clientIds[3],
      description: "Application mobile iOS/Android pour gestion commerciale",
      amount: "22000.00",
      sentDate: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: "Refusé",
      notes: "Budget trop élevé pour le client, possibilité de reproposer une version allégée",
      plannedFollowUpDate: undefined,
      acceptedAt: undefined,
    },
    {
      reference: "DEV-2024-005",
      clientId: clientIds[4],
      description: "Plateforme SaaS de gestion de projets avec intégrations",
      amount: "35000.00",
      sentDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: "Envoyé",
      notes: "Devis détaillé envoyé, premier contact très positif",
      plannedFollowUpDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      acceptedAt: undefined,
    },
    {
      reference: "DEV-2024-006",
      clientId: clientIds[1],
      description: "Module de facturation automatisée pour ERP existant",
      amount: "9500.00",
      sentDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: "En attente",
      notes: "Besoin de précisions techniques, RDV prévu la semaine prochaine",
      plannedFollowUpDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      acceptedAt: undefined,
    },
  ];

  return quotes;
}

/**
 * Generate sample follow-ups for quotes
 */
export function createDemoFollowUps(quoteIds: string[]): InsertFollowUp[] {
  const followUps: InsertFollowUp[] = [
    {
      quoteId: quoteIds[0], // Tech Solutions SARL - Accepted quote
      date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      comment: "Appel téléphonique: Discussion sur les détails techniques, client très motivé",
    },
    {
      quoteId: quoteIds[1], // Innovation Corp - En attente
      date: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      comment: "Email de suivi: Envoi de documents complémentaires demandés",
    },
    {
      quoteId: quoteIds[2], // Digital Agency - Relancé
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      comment: "Appel téléphonique: Relance effectuée, client demande délai supplémentaire pour décision",
    },
    {
      quoteId: quoteIds[3], // Consulting Plus - Refusé
      date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      comment: "Réunion: Présentation détaillée du projet, feedback positif mais budget insuffisant",
    },
    {
      quoteId: quoteIds[5], // Innovation Corp - Module facturation
      date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      comment: "Email de suivi: Clarifications sur l'intégration avec leur système existant",
    },
  ];

  return followUps;
}

/**
 * Generate complete demo dataset with proper async flow
 */
export async function generateDemoData(storage: any) {
  const demoUser = createDemoUser();
  const clientsData = createDemoClients();
  
  // Create clients first to get their IDs
  const createdClients: Client[] = [];
  for (const clientData of clientsData) {
    const client = await storage.createClient(clientData);
    createdClients.push(client);
  }
  
  // Create quotes with actual client IDs
  const clientIds = createdClients.map(c => c.id);
  const quotesData = createDemoQuotes(clientIds);
  const createdQuotes: Quote[] = [];
  for (const quoteData of quotesData) {
    const quote = await storage.createQuote(quoteData);
    createdQuotes.push(quote);
  }
  
  // Create follow-ups with actual quote IDs
  const quoteIds = createdQuotes.map(q => q.id);
  const followUpsData = createDemoFollowUps(quoteIds);
  const createdFollowUps: FollowUp[] = [];
  for (const followUpData of followUpsData) {
    const followUp = await storage.createFollowUp(followUpData);
    createdFollowUps.push(followUp);
  }

  return {
    user: demoUser,
    clients: createdClients,
    quotes: createdQuotes,
    followUps: createdFollowUps,
  };
}

/**
 * Check if demo mode is enabled
 */
export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "1";
}