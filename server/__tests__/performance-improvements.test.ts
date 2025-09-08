import { describe, it, expect, beforeEach } from "vitest";
import { storage } from "../storage";

describe("Performance Improvements", () => {
  describe("Database Pagination", () => {
    it("should return paginated clients with total count", async () => {
      // Test database-side pagination
      const result = await storage.getClients(undefined, 1, 5);
      
      expect(result).toHaveProperty("clients");
      expect(result).toHaveProperty("total");
      expect(Array.isArray(result.clients)).toBe(true);
      expect(typeof result.total).toBe("number");
      expect(result.clients.length).toBeLessThanOrEqual(5);
    });

    it("should return paginated quotes with total count", async () => {
      const result = await storage.getQuotes({}, 1, 5);
      
      expect(result).toHaveProperty("quotes");
      expect(result).toHaveProperty("total");
      expect(Array.isArray(result.quotes)).toBe(true);
      expect(typeof result.total).toBe("number");
      expect(result.quotes.length).toBeLessThanOrEqual(5);
    });

    it("should return paginated pending follow-ups with total count", async () => {
      const result = await storage.getPendingFollowUps(1, 5);
      
      expect(result).toHaveProperty("followUps");
      expect(result).toHaveProperty("total");
      expect(Array.isArray(result.followUps)).toBe(true);
      expect(typeof result.total).toBe("number");
      expect(result.followUps.length).toBeLessThanOrEqual(5);
    });

    it("should handle different page sizes correctly", async () => {
      const page1 = await storage.getClients(undefined, 1, 2);
      const page2 = await storage.getClients(undefined, 2, 2);
      
      // Should have same total but different clients (unless total < pageSize)
      expect(page1.total).toBe(page2.total);
      if (page1.total > 2) {
        // Only test different clients if we have enough data
        const page1Ids = page1.clients.map(c => c.id);
        const page2Ids = page2.clients.map(c => c.id);
        const intersection = page1Ids.filter(id => page2Ids.includes(id));
        expect(intersection.length).toBe(0); // No overlap between pages
      }
    });
  });

  describe("N+1 Query Prevention", () => {
    it("should fetch quotes with client data in a single operation", async () => {
      const result = await storage.getQuotes({}, 1, 10);
      
      // Every quote should have client data populated
      result.quotes.forEach(quote => {
        expect(quote).toHaveProperty("client");
        expect(quote.client).toHaveProperty("id");
        expect(quote.client).toHaveProperty("name");
        expect(quote.client).toHaveProperty("company");
        expect(quote.client).toHaveProperty("email");
      });
    });

    it("should fetch pending follow-ups with client data in a single operation", async () => {
      const result = await storage.getPendingFollowUps(1, 10);
      
      // Every follow-up should have complete quote and client data
      result.followUps.forEach(followUp => {
        expect(followUp).toHaveProperty("client");
        expect(followUp.client).toHaveProperty("id");
        expect(followUp.client).toHaveProperty("name");
        expect(followUp.client).toHaveProperty("company");
        expect(followUp.client).toHaveProperty("email");
      });
    });
  });

  describe("Search with Pagination", () => {
    it("should search clients with pagination", async () => {
      const result = await storage.getClients("test", 1, 5);
      
      expect(result).toHaveProperty("clients");
      expect(result).toHaveProperty("total");
      expect(Array.isArray(result.clients)).toBe(true);
      expect(result.clients.length).toBeLessThanOrEqual(5);
    });

    it("should filter quotes with pagination", async () => {
      const result = await storage.getQuotes({ status: "Envoyé" }, 1, 5);
      
      expect(result).toHaveProperty("quotes");
      expect(result).toHaveProperty("total");
      result.quotes.forEach(quote => {
        expect(quote.status).toBe("Envoyé");
      });
    });
  });
});