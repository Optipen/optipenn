import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertClientSchema, insertQuoteSchema, insertFollowUpSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Client routes
  app.get("/api/clients", async (req, res) => {
    try {
      const search = req.query.search as string | undefined;
      const clients = await storage.getClients(search);
      res.json(clients);
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de la récupération des clients" });
    }
  });

  app.get("/api/clients/:id", async (req, res) => {
    try {
      const client = await storage.getClient(req.params.id);
      if (!client) {
        return res.status(404).json({ message: "Client non trouvé" });
      }
      res.json(client);
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de la récupération du client" });
    }
  });

  app.post("/api/clients", async (req, res) => {
    try {
      const clientData = insertClientSchema.parse(req.body);
      const client = await storage.createClient(clientData);
      res.status(201).json(client);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Données invalides", errors: error.errors });
      }
      res.status(500).json({ message: "Erreur lors de la création du client" });
    }
  });

  app.put("/api/clients/:id", async (req, res) => {
    try {
      const updates = insertClientSchema.partial().parse(req.body);
      const client = await storage.updateClient(req.params.id, updates);
      if (!client) {
        return res.status(404).json({ message: "Client non trouvé" });
      }
      res.json(client);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Données invalides", errors: error.errors });
      }
      res.status(500).json({ message: "Erreur lors de la mise à jour du client" });
    }
  });

  app.delete("/api/clients/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteClient(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Client non trouvé" });
      }
      res.json({ message: "Client supprimé avec succès" });
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de la suppression du client" });
    }
  });

  // Quote routes
  app.get("/api/quotes", async (req, res) => {
    try {
      const filters = {
        status: req.query.status as string | undefined,
        clientId: req.query.clientId as string | undefined,
      };
      const quotes = await storage.getQuotes(filters);
      res.json(quotes);
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de la récupération des devis" });
    }
  });

  app.get("/api/quotes/:id", async (req, res) => {
    try {
      const quote = await storage.getQuote(req.params.id);
      if (!quote) {
        return res.status(404).json({ message: "Devis non trouvé" });
      }
      res.json(quote);
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de la récupération du devis" });
    }
  });

  app.post("/api/quotes", async (req, res) => {
    try {
      const quoteData = insertQuoteSchema.parse(req.body);
      const quote = await storage.createQuote(quoteData);
      res.status(201).json(quote);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Données invalides", errors: error.errors });
      }
      res.status(500).json({ message: "Erreur lors de la création du devis" });
    }
  });

  app.put("/api/quotes/:id", async (req, res) => {
    try {
      const updates = insertQuoteSchema.partial().parse(req.body);
      const quote = await storage.updateQuote(req.params.id, updates);
      if (!quote) {
        return res.status(404).json({ message: "Devis non trouvé" });
      }
      res.json(quote);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Données invalides", errors: error.errors });
      }
      res.status(500).json({ message: "Erreur lors de la mise à jour du devis" });
    }
  });

  app.delete("/api/quotes/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteQuote(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Devis non trouvé" });
      }
      res.json({ message: "Devis supprimé avec succès" });
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de la suppression du devis" });
    }
  });

  // Follow-up routes
  app.get("/api/quotes/:id/follow-ups", async (req, res) => {
    try {
      const followUps = await storage.getFollowUps(req.params.id);
      res.json(followUps);
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de la récupération des relances" });
    }
  });

  app.post("/api/quotes/:id/follow-up", async (req, res) => {
    try {
      const followUpData = insertFollowUpSchema.parse({
        ...req.body,
        quoteId: req.params.id,
      });
      const followUp = await storage.createFollowUp(followUpData);
      res.status(201).json(followUp);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Données invalides", errors: error.errors });
      }
      res.status(500).json({ message: "Erreur lors de la création de la relance" });
    }
  });

  app.get("/api/pending-follow-ups", async (req, res) => {
    try {
      const pendingFollowUps = await storage.getPendingFollowUps();
      res.json(pendingFollowUps);
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de la récupération des relances en attente" });
    }
  });

  // Statistics routes
  app.get("/api/statistics", async (req, res) => {
    try {
      const stats = await storage.getQuoteStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de la récupération des statistiques" });
    }
  });

  // CSV export route
  app.get("/api/export/quotes", async (req, res) => {
    try {
      const quotes = await storage.getQuotes();
      
      // Generate CSV
      const csvHeader = "Référence,Client,Entreprise,Description,Montant,Date d'envoi,Statut\n";
      const csvRows = quotes.map(quote => 
        `"${quote.reference}","${quote.client.name}","${quote.client.company}","${quote.description}","${quote.amount}","${quote.sentDate}","${quote.status}"`
      ).join("\n");
      
      const csv = csvHeader + csvRows;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="devis.csv"');
      res.send(csv);
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de l'export CSV" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
