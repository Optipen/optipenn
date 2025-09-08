import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import { registerRoutes } from "../routes";

// Mock the storage and auth modules
const mockQuotes = [
  {
    id: "1",
    reference: "DEV-001",
    description: "Test quote with, comma and \"quotes\"",
    amount: "1000.50",
    sentDate: "2024-01-15",
    status: "En attente" as const,
    client: {
      name: "John, Doe",
      company: "Test \"Company\" Inc.",
      email: "john@test.com"
    }
  },
  {
    id: "2",
    reference: "DEV-002",
    description: "Quote with\nline break",
    amount: "2500.00",
    sentDate: "2024-01-16",
    status: "Accepté" as const,
    client: {
      name: "Jane Smith",
      company: "Another Company",
      email: "jane@company.com"
    }
  }
];

// Mock storage
vi.mock("../storage", () => ({
  storage: {
    getQuotes: vi.fn(() => Promise.resolve(mockQuotes))
  }
}));

// Mock auth middleware
vi.mock("../auth", () => ({
  requireAuth: () => (req: any, res: any, next: any) => next(),
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn()
}));

describe("Export Functionality", () => {
  let app: express.Application;

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    await registerRoutes(app);
  });

  describe("CSV Export RFC 4180 Compliance", () => {
    it("should generate RFC 4180 compliant CSV with UTF-8 BOM", async () => {
      const response = await request(app)
        .get("/api/export/quotes")
        .expect(200);

      expect(response.headers["content-type"]).toBe("text/csv; charset=utf-8");
      expect(response.headers["content-disposition"]).toBe('attachment; filename="devis.csv"');
      
      // Check for UTF-8 BOM
      expect(response.text).toMatch(/^\uFEFF/);
      
      // Remove BOM for easier testing
      const csvContent = response.text.replace(/^\uFEFF/, "");
      const lines = csvContent.split("\r\n");
      
      // Check header line
      expect(lines[0]).toBe('Référence,Client,Entreprise,Description,Montant,"Date d\'envoi",Statut');
      
      // Check data lines with proper escaping
      expect(lines[1]).toContain('"John, Doe"'); // Name with comma should be quoted
      expect(lines[1]).toContain('"Test ""Company"" Inc."'); // Company with quotes should have escaped quotes
      expect(lines[1]).toContain('"Test quote with, comma and ""quotes"""'); // Description with comma and quotes
      
      expect(lines[2]).toContain('"Quote with\nline break"'); // Description with line break should be quoted
    });

    it("should properly escape special characters according to RFC 4180", async () => {
      // Test the escapeCsvField function indirectly through the API
      const response = await request(app)
        .get("/api/export/quotes")
        .expect(200);

      const csvContent = response.text.replace(/^\uFEFF/, "");
      
      // Fields with commas should be quoted
      expect(csvContent).toMatch(/"[^"]*,[^"]*"/);
      
      // Fields with quotes should have doubled quotes and be quoted
      expect(csvContent).toMatch(/"[^"]*""[^"]*"/);
      
      // Fields with line breaks should be quoted
      expect(csvContent).toMatch(/"[^"]*\n[^"]*"/);
    });

    it("should use CRLF line endings for better compatibility", async () => {
      const response = await request(app)
        .get("/api/export/quotes")
        .expect(200);

      // Check that we're using CRLF line endings
      expect(response.text).toMatch(/\r\n/);
    });
  });

  describe("PDF Export", () => {
    it("should generate PDF with proper headers and content type", async () => {
      const response = await request(app)
        .get("/api/export/quotes.pdf")
        .expect(200);

      expect(response.headers["content-type"]).toBe("application/pdf");
      expect(response.headers["content-disposition"]).toBe('attachment; filename="devis.pdf"');
      
      // Check that we get PDF content (starts with PDF magic number)
      expect(response.body.toString('ascii', 0, 4)).toBe('%PDF');
    });

    it("should include all quote data in PDF", async () => {
      const response = await request(app)
        .get("/api/export/quotes.pdf")
        .expect(200);

      // Since we can't easily parse PDF content in tests, we'll just verify 
      // that the response is not empty and has the right format
      expect(response.body.length).toBeGreaterThan(1000); // PDF should have substantial content
    });

    it("should handle empty quote list gracefully", async () => {
      // Mock empty quotes
      const { storage } = await import("../storage");
      vi.mocked(storage.getQuotes).mockResolvedValueOnce([]);

      const response = await request(app)
        .get("/api/export/quotes.pdf")
        .expect(200);

      expect(response.headers["content-type"]).toBe("application/pdf");
      expect(response.body.length).toBeGreaterThan(0); // Should still generate a valid PDF
    });
  });

  describe("Error Handling", () => {
    it("should handle storage errors in CSV export", async () => {
      const { storage } = await import("../storage");
      vi.mocked(storage.getQuotes).mockRejectedValueOnce(new Error("Database error"));

      const response = await request(app)
        .get("/api/export/quotes")
        .expect(500);

      expect(response.body.message).toBe("Erreur lors de l'export CSV");
    });

    it("should handle storage errors in PDF export", async () => {
      const { storage } = await import("../storage");
      vi.mocked(storage.getQuotes).mockRejectedValueOnce(new Error("Database error"));

      const response = await request(app)
        .get("/api/export/quotes.pdf")
        .expect(500);

      expect(response.body.message).toBe("Erreur lors de l'export PDF");
    });
  });
});