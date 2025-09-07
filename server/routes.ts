import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { getDb } from "./db";
import { insertClientSchema, insertQuoteSchema, insertFollowUpSchema } from "@shared/schema";
import { z } from "zod";
import { requireAuth, login, logout, register } from "./auth";
import rateLimit from "express-rate-limit";
import PDFDocument from "pdfkit";
import type { Request, Response, NextFunction } from "express";

function escapeCsvField(value: unknown): string {
  const raw = value == null ? "" : String(value);
  const needsQuoting = /[",\n\r]/.test(raw);
  let escaped = raw.replace(/"/g, '""');
  return needsQuoting ? `"${escaped}"` : escaped;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Simple CSRF middleware: require X-CSRF-Token to match csrf_token cookie on state-changing requests
  const csrfProtect = (req: Request, res: Response, next: NextFunction) => {
    const method = req.method.toUpperCase();
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      const header = req.header("X-CSRF-Token");
      const cookie = (req as any).cookies?.["csrf_token"];
      if (!header || !cookie || header !== cookie) {
        return res.status(403).json({ message: "CSRF invalide" });
      }
    }
    next();
  };
  // Auth routes
  app.post("/api/auth/register", register);
  const loginLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
  app.post("/api/auth/login", loginLimiter, login);
  app.post("/api/auth/logout", csrfProtect, logout);

  // Client routes
  app.get("/api/clients", requireAuth(["admin", "manager", "sales"]), async (req, res) => {
    try {
      const search = req.query.search as string | undefined;
      const page = Math.max(parseInt((req.query.page as string) || "1", 10), 1);
      const pageSize = Math.min(Math.max(parseInt((req.query.pageSize as string) || "10", 10), 1), 200);
      const sortBy = (req.query.sortBy as string) || "name"; // name | company | email
      const sortDir = ((req.query.sortDir as string) || "asc").toLowerCase() === "desc" ? "desc" : "asc";

      let list = await storage.getClients(search);
      if (["name", "company", "email"].includes(sortBy)) {
        list = list.sort((a: any, b: any) => (sortDir === "asc" ? 1 : -1) * String(a[sortBy]).localeCompare(String(b[sortBy])));
      }
      const total = list.length;
      const start = (page - 1) * pageSize;
      const items = list.slice(start, start + pageSize);
      res.setHeader("X-Total-Count", String(total));
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de la récupération des clients" });
    }
  });

  app.get("/api/clients/:id", requireAuth(["admin", "manager", "sales"]), async (req, res) => {
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

  app.post("/api/clients", csrfProtect, requireAuth(["admin", "manager", "sales"]), async (req, res) => {
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

  app.put("/api/clients/:id", csrfProtect, requireAuth(["admin", "manager"]), async (req, res) => {
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

  app.delete("/api/clients/:id", csrfProtect, requireAuth(["admin"]), async (req, res) => {
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
  app.get("/api/quotes", requireAuth(["admin", "manager", "sales"]), async (req, res) => {
    try {
      const filters = {
        status: req.query.status as string | undefined,
        clientId: req.query.clientId as string | undefined,
      };
      const page = Math.max(parseInt((req.query.page as string) || "1", 10), 1);
      const pageSize = Math.min(Math.max(parseInt((req.query.pageSize as string) || "10", 10), 1), 200);
      let quotes = await storage.getQuotes(filters);
      const total = quotes.length;
      const start = (page - 1) * pageSize;
      const items = quotes.slice(start, start + pageSize);
      res.setHeader("X-Total-Count", String(total));
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de la récupération des devis" });
    }
  });

  app.get("/api/quotes/:id", requireAuth(["admin", "manager", "sales"]), async (req, res) => {
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

  app.post("/api/quotes", csrfProtect, requireAuth(["admin", "manager", "sales"]), async (req, res) => {
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

  app.put("/api/quotes/:id", csrfProtect, requireAuth(["admin", "manager"]), async (req, res) => {
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

  app.delete("/api/quotes/:id", csrfProtect, requireAuth(["admin"]), async (req, res) => {
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
  app.get("/api/quotes/:id/follow-ups", requireAuth(["admin", "manager", "sales"]), async (req, res) => {
    try {
      const followUps = await storage.getFollowUps(req.params.id);
      res.json(followUps);
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de la récupération des relances" });
    }
  });

  app.post("/api/quotes/:id/follow-up", csrfProtect, requireAuth(["admin", "manager", "sales"]), async (req, res) => {
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

  app.get("/api/pending-follow-ups", requireAuth(["admin", "manager", "sales"]), async (req, res) => {
    try {
      const pendingFollowUps = await storage.getPendingFollowUps();
      res.json(pendingFollowUps);
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de la récupération des relances en attente" });
    }
  });

  // Statistics routes
  app.get("/api/statistics", requireAuth(["admin", "manager", "sales"]), async (req, res) => {
    try {
      const stats = await storage.getQuoteStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de la récupération des statistiques" });
    }
  });

  // Healthcheck route
  app.get("/api/health", async (_req, res) => {
    const startedAt = new Date(Date.now() - Math.floor(process.uptime() * 1000));
    const db = getDb();
    const dbConnected = !!db;
    const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
    res.json({
      status: "ok",
      env: app.get("env"),
      uptimeSec: Math.floor(process.uptime()),
      startedAt: startedAt.toISOString(),
      db: { connected: dbConnected },
      smtp: { configured: smtpConfigured },
    });
  });

  // CSV export route
  app.get("/api/export/quotes", requireAuth(["admin", "manager", "sales"]), async (req, res) => {
    try {
      const quotes = await storage.getQuotes();

      // Generate CSV (RFC 4180 + BOM for Excel)
      const headers = [
        "Référence",
        "Client",
        "Entreprise",
        "Description",
        "Montant",
        "Date d'envoi",
        "Statut",
      ];
      const headerLine = headers.map(escapeCsvField).join(",");
      const rows = quotes.map((q) => [
        q.reference,
        q.client.name,
        q.client.company,
        q.description,
        q.amount,
        q.sentDate,
        q.status,
      ].map(escapeCsvField).join(",")).join("\n");
      const csv = `\uFEFF${headerLine}\n${rows}`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="devis.csv"');
      res.send(csv);
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de l'export CSV" });
    }
  });

  // PDF export (server-side using pdfkit)
  app.get("/api/export/quotes.pdf", requireAuth(["admin", "manager", "sales"]), async (_req, res) => {
    try {
      const quotes = await storage.getQuotes();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'attachment; filename="devis.pdf"');
      const doc = new PDFDocument({ size: "A4", margin: 40 });
      doc.pipe(res);

      doc.fontSize(18).text("Liste des devis", { align: "center" });
      doc.moveDown();

      const headers = ["Référence", "Client", "Description", "Montant", "Date", "Statut"]; 
      const colWidths = [100, 130, 150, 70, 70, 70];
      const startX = doc.x;
      let y = doc.y;

      doc.fontSize(10).fillColor("#111827");
      headers.forEach((h, i) => {
        doc.text(h, startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0), y, { width: colWidths[i], continued: i !== headers.length - 1 });
      });
      doc.moveDown(0.5);
      y = doc.y;
      doc.moveTo(startX, y).lineTo(startX + colWidths.reduce((a, b) => a + b, 0), y).stroke("#E5E7EB");

      for (const q of quotes) {
        if (doc.y > doc.page.height - 80) {
          doc.addPage();
          y = doc.y;
        }
        const row = [q.reference, q.client.company, q.description, `€${parseFloat(q.amount as any).toLocaleString()}`, new Date(q.sentDate).toLocaleDateString("fr-FR"), q.status];
        row.forEach((cell, i) => {
          doc.text(String(cell), startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0), doc.y, { width: colWidths[i], continued: i !== row.length - 1 });
        });
        doc.moveDown(0.5);
      }

      doc.end();
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de l'export PDF" });
    }
  });

  // GDPR: export all data for a client (client + quotes + followUps)
  app.get("/api/gdpr/clients/:id/export", requireAuth(["admin", "manager"]), async (req, res) => {
    try {
      const client = await storage.getClient(req.params.id);
      if (!client) return res.status(404).json({ message: "Client non trouvé" });
      const quotes = await storage.getQuotesByClientId(req.params.id);
      const withFollowUps = [] as any[];
      for (const q of quotes) {
        const fu = await storage.getFollowUps(q.id);
        withFollowUps.push({ ...q, followUps: fu });
      }
      res.json({ client, quotes: withFollowUps });
    } catch {
      res.status(500).json({ message: "Erreur lors de l'export RGPD" });
    }
  });

  // GDPR: delete all data for a client (alias of delete client)
  app.delete("/api/gdpr/clients/:id", csrfProtect, requireAuth(["admin"]), async (req, res) => {
    try {
      const ok = await storage.deleteClient(req.params.id);
      if (!ok) return res.status(404).json({ message: "Client non trouvé" });
      res.json({ message: "Données client supprimées" });
    } catch {
      res.status(500).json({ message: "Erreur lors de la suppression RGPD" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
