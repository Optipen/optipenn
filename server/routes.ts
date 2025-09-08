import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { getDb } from "./db";
import { insertClientSchema, insertQuoteSchema, insertFollowUpSchema, clients } from "@shared/schema";
import { z } from "zod";
import { requireAuth, login, logout, register } from "./auth";
import rateLimit from "express-rate-limit";
import PDFDocument from "pdfkit";
import type { Request, Response, NextFunction } from "express";
import { logger } from "./logger";
import { metrics } from "./metrics";

function escapeCsvField(value: unknown): string {
  const raw = value == null ? "" : String(value);
  // RFC 4180: Fields containing line breaks (CRLF), double quotes, or commas should be enclosed in double quotes
  const needsQuoting = /[",\n\r]/.test(raw);
  // RFC 4180: If double quotes are used to enclose fields, then a double quote appearing inside a field must be escaped by preceding it with another double quote
  const escaped = raw.replace(/"/g, '""');
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
  // Auth routes with brute-force protection
  
  // Rate limiter for registration - prevent account creation spam
  const registerLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Increased to 10 registration attempts per 15 minutes per IP
    message: { message: "Trop de tentatives d'inscription. Réessayez dans 15 minutes." },
    standardHeaders: true,
    legacyHeaders: false,
    // Count all requests, not just failed ones for registration to prevent spam
    skipSuccessfulRequests: false
  });
  
  // Enhanced rate limiter for login - more restrictive against brute-force
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Increased to 10 attempts per window to allow for legitimate failed attempts
    message: { message: "Trop de tentatives de connexion. Réessayez dans 15 minutes." },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip successful requests to only count failed ones
    skipSuccessfulRequests: true
  });
  
  // Progressive delay limiter for severe brute-force attempts
  const strictLoginLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // Maximum 20 attempts per hour (increased from 10)
    message: { message: "Compte temporairement verrouillé. Réessayez dans 1 heure." },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true
  });
  
  app.post("/api/auth/register", registerLimiter, register);
  app.post("/api/auth/login", strictLoginLimiter, loginLimiter, login);
  app.post("/api/auth/logout", csrfProtect, logout);

  // Client routes
  app.get("/api/clients", requireAuth(["admin", "manager", "sales"]), async (req, res) => {
    const startTime = Date.now();
    try {
      const search = req.query.search as string | undefined;
      const page = Math.max(parseInt((req.query.page as string) || "1", 10), 1);
      const pageSize = Math.min(Math.max(parseInt((req.query.pageSize as string) || "10", 10), 1), 200);
      const sortBy = (req.query.sortBy as string) || "name"; // name | company | email
      const sortDir = ((req.query.sortDir as string) || "asc").toLowerCase() === "desc" ? "desc" : "asc";

      const result = await storage.getClients(search, page, pageSize);
      
      // Apply sorting to the clients array
      if (["name", "company", "email"].includes(sortBy)) {
        result.clients = result.clients.sort((a: any, b: any) => 
          (sortDir === "asc" ? 1 : -1) * String(a[sortBy]).localeCompare(String(b[sortBy]))
        );
      }

      res.setHeader("X-Total-Count", String(result.total));
      res.json(result.clients);

      const duration = Date.now() - startTime;
      metrics.recordRequest(res.statusCode, duration);
      logger.logPerformance("GET /api/clients", duration, { 
        search, page, pageSize, total: result.total 
      });
    } catch (error) {
      logger.error("Error in GET /api/clients", { search: req.query.search }, error as Error);
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
    const startTime = Date.now();
    try {
      const filters = {
        status: req.query.status as string | undefined,
        clientId: req.query.clientId as string | undefined,
      };
      const page = Math.max(parseInt((req.query.page as string) || "1", 10), 1);
      const pageSize = Math.min(Math.max(parseInt((req.query.pageSize as string) || "10", 10), 1), 200);
      
      const result = await storage.getQuotes(filters, page, pageSize);
      res.setHeader("X-Total-Count", String(result.total));
      res.json(result.quotes);

      const duration = Date.now() - startTime;
      metrics.recordRequest(res.statusCode, duration);
      logger.logPerformance("GET /api/quotes", duration, { 
        filters, page, pageSize, total: result.total 
      });
    } catch (error) {
      logger.error("Error in GET /api/quotes", { filters: req.query }, error as Error);
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
    const startTime = Date.now();
    try {
      const page = Math.max(parseInt((req.query.page as string) || "1", 10), 1);
      const pageSize = Math.min(Math.max(parseInt((req.query.pageSize as string) || "10", 10), 1), 50);
      
      const result = await storage.getPendingFollowUps(page, pageSize);
      res.setHeader("X-Total-Count", String(result.total));
      res.json(result.followUps);

      const duration = Date.now() - startTime;
      metrics.recordRequest(res.statusCode, duration);
      logger.logPerformance("GET /api/pending-follow-ups", duration, { 
        page, pageSize, total: result.total 
      });
    } catch (error) {
      logger.error("Error in GET /api/pending-follow-ups", { page: req.query.page }, error as Error);
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

  // Enhanced healthcheck route with detailed metrics
  app.get("/api/health", async (_req, res) => {
    const startTime = Date.now();
    try {
      const startedAt = new Date(Date.now() - Math.floor(process.uptime() * 1000));
      const db = getDb();
      let dbConnected = false;
      let dbLatency = 0;

      // Test database connection and measure latency
      if (db) {
        try {
          const dbStart = Date.now();
          await db.select().from(clients).limit(1);
          dbLatency = Date.now() - dbStart;
          dbConnected = true;
        } catch {
          dbConnected = false;
        }
      }

      const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
      const memoryUsage = process.memoryUsage();
      const performance = metrics.getMetrics();

      const healthStatus = {
        status: dbConnected ? "healthy" : "degraded",
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        startedAt: startedAt.toISOString(),
        environment: process.env.NODE_ENV || "development",
        version: process.env.npm_package_version || "1.0.0",
        database: {
          connected: dbConnected,
          latency: dbLatency,
        },
        smtp: {
          configured: smtpConfigured,
        },
        memory: {
          usage: memoryUsage,
          usageMB: {
            rss: Math.round(memoryUsage.rss / 1024 / 1024 * 100) / 100,
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100,
            heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024 * 100) / 100,
            external: Math.round(memoryUsage.external / 1024 / 1024 * 100) / 100,
          }
        },
        performance: {
          totalRequests: performance.totalRequests,
          averageResponseTime: performance.averageResponseTime,
          requestsByStatus: performance.requestsByStatus,
        }
      };

      res.json(healthStatus);

      const duration = Date.now() - startTime;
      metrics.recordRequest(res.statusCode, duration);
      logger.info("Health check completed", { duration, healthStatus: healthStatus.status });
    } catch (error) {
      logger.error("Health check failed", {}, error as Error);
      res.status(503).json({
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: "Health check failed"
      });
    }
  });

  // Performance metrics endpoint
  app.get("/api/metrics", requireAuth(["admin"]), async (_req, res) => {
    const startTime = Date.now();
    try {
      const performance = metrics.getMetrics();
      res.json(performance);

      const duration = Date.now() - startTime;
      metrics.recordRequest(res.statusCode, duration);
      logger.info("Metrics accessed", { duration });
    } catch (error) {
      logger.error("Error retrieving metrics", {}, error as Error);
      res.status(500).json({ message: "Erreur lors de la récupération des métriques" });
    }
  });

  // Reset metrics endpoint (admin only)
  app.post("/api/metrics/reset", requireAuth(["admin"]), async (_req, res) => {
    try {
      metrics.reset();
      res.json({ message: "Métriques réinitialisées avec succès" });
      logger.info("Metrics reset by admin");
    } catch (error) {
      logger.error("Error resetting metrics", {}, error as Error);
      res.status(500).json({ message: "Erreur lors de la réinitialisation des métriques" });
    }
  });

  // CSV export route
  app.get("/api/export/quotes", requireAuth(["admin", "manager", "sales"]), async (req, res) => {
    const startTime = Date.now();
    try {
      const result = await storage.getQuotes({}, 1, 10000); // Get all quotes for export
      const quotes = result.quotes;

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
      ].map(escapeCsvField).join(",")).join("\r\n"); // RFC 4180: Use CRLF line endings
      const csv = `\uFEFF${headerLine}\r\n${rows}`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="devis.csv"');
      res.send(csv);

      const duration = Date.now() - startTime;
      metrics.recordRequest(res.statusCode, duration);
      logger.logPerformance("GET /api/export/quotes", duration, { 
        exportType: "csv", count: quotes.length 
      });
    } catch (error) {
      logger.error("Error in CSV export", {}, error as Error);
      res.status(500).json({ message: "Erreur lors de l'export CSV" });
    }
  });

  // PDF export (server-side using pdfkit)
  app.get("/api/export/quotes.pdf", requireAuth(["admin", "manager", "sales"]), async (_req, res) => {
    const startTime = Date.now();
    try {
      const result = await storage.getQuotes({}, 1, 10000); // Get all quotes for export
      const quotes = result.quotes;
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'attachment; filename="devis.pdf"');
      
      const doc = new PDFDocument({ 
        size: "A4", 
        margin: 50,
        info: {
          Title: "Liste des Devis",
          Author: "OptiPen CRM",
          Subject: "Export des devis",
          Creator: "OptiPen CRM System"
        }
      });
      doc.pipe(res);

      // Document header with company branding
      doc.fontSize(24).fillColor("#2563eb").text("OptiPen CRM", { align: "left" });
      doc.fontSize(18).fillColor("#1f2937").text("Liste des Devis", { align: "left" });
      doc.fontSize(10).fillColor("#6b7280").text(`Généré le ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR")}`, { align: "left" });
      
      // Add separator line
      doc.moveTo(50, doc.y + 10).lineTo(545, doc.y + 10).strokeColor("#e5e7eb").stroke();
      doc.moveDown(1.5);

      // Summary statistics
      const totalAmount = quotes.reduce((sum, q) => sum + parseFloat(q.amount as any), 0);
      const pendingCount = quotes.filter(q => q.status === "En attente").length;
      const acceptedCount = quotes.filter(q => q.status === "Accepté").length;
      const rejectedCount = quotes.filter(q => q.status === "Refusé").length;

      doc.fontSize(12).fillColor("#374151");
      doc.text(`Nombre total de devis: ${quotes.length}`, { continued: true });
      doc.text(`  •  Montant total: ${totalAmount.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}`, { align: "left" });
      doc.text(`En attente: ${pendingCount}  •  Acceptés: ${acceptedCount}  •  Refusés: ${rejectedCount}`);
      doc.moveDown(1);

      if (quotes.length === 0) {
        doc.fontSize(14).fillColor("#6b7280").text("Aucun devis à afficher", { align: "center" });
        doc.end();
        return;
      }

      // Table setup
      const headers = ["Référence", "Client", "Entreprise", "Description", "Montant", "Date", "Statut"];
      const colWidths = [80, 100, 110, 140, 70, 60, 60];
      const startX = 50;
      const tableWidth = colWidths.reduce((a, b) => a + b, 0);
      let currentY = doc.y;

      // Function to draw table header
      const drawHeader = () => {
        currentY = doc.y;
        
        // Header background
        doc.rect(startX, currentY - 5, tableWidth, 25).fillColor("#f3f4f6").fill();
        
        // Header text
        doc.fontSize(10).fillColor("#374151");
        let currentX = startX;
        headers.forEach((header, i) => {
          doc.text(header, currentX + 5, currentY + 5, { 
            width: colWidths[i] - 10, 
            align: "left",
            continued: i !== headers.length - 1 
          });
          currentX += colWidths[i];
        });
        
        doc.moveDown(0.3);
        currentY = doc.y;
        
        // Header border
        doc.rect(startX, currentY - 25, tableWidth, 25).strokeColor("#d1d5db").stroke();
        
        // Vertical lines for header
        let x = startX;
        for (let i = 0; i < colWidths.length - 1; i++) {
          x += colWidths[i];
          doc.moveTo(x, currentY - 25).lineTo(x, currentY).stroke();
        }
      };

      // Function to check if we need a new page
      const checkNewPage = (rowHeight = 20) => {
        if (currentY + rowHeight > doc.page.height - 80) {
          doc.addPage();
          currentY = 80;
          drawHeader();
        }
      };

      // Draw initial header
      drawHeader();

      // Table rows
      quotes.forEach((quote, index) => {
        checkNewPage(25);
        
        const rowY = currentY;
        
        // Alternate row background
        if (index % 2 === 1) {
          doc.rect(startX, rowY, tableWidth, 20).fillColor("#f9fafb").fill();
        }
        
        // Status color coding
        let statusColor = "#6b7280";
        if (quote.status === "Accepté") statusColor = "#059669";
        else if (quote.status === "Refusé") statusColor = "#dc2626";
        else if (quote.status === "En attente") statusColor = "#d97706";
        
        // Row data
        const rowData = [
          quote.reference,
          quote.client.name.length > 15 ? quote.client.name.substring(0, 12) + "..." : quote.client.name,
          quote.client.company.length > 18 ? quote.client.company.substring(0, 15) + "..." : quote.client.company,
          quote.description.length > 25 ? quote.description.substring(0, 22) + "..." : quote.description,
          parseFloat(quote.amount as any).toLocaleString("fr-FR", { style: "currency", currency: "EUR" }),
          new Date(quote.sentDate).toLocaleDateString("fr-FR"),
          quote.status
        ];
        
        doc.fontSize(9).fillColor("#374151");
        let currentX = startX;
        rowData.forEach((data, i) => {
          const color = i === 6 ? statusColor : "#374151"; // Status column uses status color
          doc.fillColor(color).text(String(data), currentX + 3, rowY + 5, { 
            width: colWidths[i] - 6, 
            align: i === 4 ? "right" : "left", // Amount column right-aligned
            continued: i !== rowData.length - 1 
          });
          currentX += colWidths[i];
        });
        
        doc.moveDown(0.3);
        currentY = doc.y;
        
        // Row border
        doc.rect(startX, rowY, tableWidth, 20).strokeColor("#e5e7eb").stroke();
        
        // Vertical lines
        let x = startX;
        for (let i = 0; i < colWidths.length - 1; i++) {
          x += colWidths[i];
          doc.moveTo(x, rowY).lineTo(x, rowY + 20).strokeColor("#e5e7eb").stroke();
        }
      });

      // Footer
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        doc.fontSize(8).fillColor("#6b7280");
        doc.text(
          `Page ${i + 1} sur ${pageCount} - OptiPen CRM - ${new Date().toLocaleDateString("fr-FR")}`,
          50,
          doc.page.height - 50,
          { align: "center", width: doc.page.width - 100 }
        );
      }

      doc.end();

      const duration = Date.now() - startTime;
      metrics.recordRequest(res.statusCode, duration);
      logger.logPerformance("GET /api/export/quotes.pdf", duration, { 
        exportType: "pdf", count: quotes.length 
      });
    } catch (error) {
      logger.error("PDF generation error", {}, error as Error);
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

  // GDPR: delete all data for a client (enhanced with audit logging)
  app.delete("/api/gdpr/clients/:id", csrfProtect, requireAuth(["admin"]), async (req, res) => {
    try {
      const ok = await storage.deleteClientWithData(req.params.id);
      if (!ok) return res.status(404).json({ message: "Client non trouvé" });
      res.json({ message: "Données client supprimées avec cascade transactionnel" });
    } catch (error) {
      console.error('GDPR deletion error:', error);
      res.status(500).json({ message: "Erreur lors de la suppression RGPD" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
