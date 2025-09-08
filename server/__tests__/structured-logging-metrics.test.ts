import { describe, it, expect, beforeEach, vi } from "vitest";
import { logger } from "../logger";
import { metrics } from "../metrics";

describe("Structured Logging and Metrics", () => {
  beforeEach(() => {
    // Reset metrics before each test
    metrics.reset();
  });

  describe("Logger", () => {
    it("should format structured logs correctly", () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      logger.info("Test message", { requestId: "123", method: "GET", path: "/test" });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"level":"info"')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"message":"Test message"')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"requestId":"123"')
      );
      
      consoleSpy.mockRestore();
    });

    it("should include timestamp in logs", () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      logger.info("Test message");
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"timestamp"')
      );
      
      consoleSpy.mockRestore();
    });

    it("should log performance metrics", () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      logger.logPerformance("test operation", 150, { operation: "database query" });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"duration":150')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"operation":"test operation"')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe("Metrics Collection", () => {
    it("should record request metrics", () => {
      metrics.recordRequest(200, 150);
      metrics.recordRequest(404, 50);
      metrics.recordRequest(500, 300);
      
      const metricsData = metrics.getMetrics();
      
      expect(metricsData.totalRequests).toBe(3);
      expect(metricsData.requestsByStatus[200]).toBe(1);
      expect(metricsData.requestsByStatus[404]).toBe(1);
      expect(metricsData.requestsByStatus[500]).toBe(1);
      expect(metricsData.averageResponseTime).toBeCloseTo(166.67, 1);
    });

    it("should record slow queries", () => {
      metrics.recordSlowQuery("SELECT * FROM clients", 250);
      metrics.recordSlowQuery("SELECT * FROM quotes", 150);
      metrics.recordSlowQuery("Fast query", 50); // Should not be recorded
      
      const metricsData = metrics.getMetrics();
      
      expect(metricsData.slowQueries.length).toBe(2);
      expect(metricsData.slowQueries[0].query).toBe("SELECT * FROM clients");
      expect(metricsData.slowQueries[0].duration).toBe(250);
    });

    it("should limit slow queries to last 50", () => {
      // Record 60 slow queries
      for (let i = 0; i < 60; i++) {
        metrics.recordSlowQuery(`Query ${i}`, 200);
      }
      
      const metricsData = metrics.getMetrics();
      
      expect(metricsData.slowQueries.length).toBe(50);
      // Should contain the most recent queries
      expect(metricsData.slowQueries[49].query).toBe("Query 59");
    });

    it("should include memory usage in metrics", () => {
      const metricsData = metrics.getMetrics();
      
      expect(metricsData.memoryUsage).toHaveProperty("rss");
      expect(metricsData.memoryUsage).toHaveProperty("heapUsed");
      expect(metricsData.memoryUsage).toHaveProperty("heapTotal");
      expect(metricsData.memoryUsage).toHaveProperty("external");
      expect(typeof metricsData.memoryUsage.rss).toBe("number");
    });

    it("should track uptime", () => {
      const metricsData = metrics.getMetrics();
      
      expect(typeof metricsData.uptime).toBe("number");
      expect(metricsData.uptime).toBeGreaterThanOrEqual(0);
    });

    it("should reset metrics correctly", () => {
      metrics.recordRequest(200, 100);
      metrics.recordSlowQuery("Test query", 200);
      
      let metricsData = metrics.getMetrics();
      expect(metricsData.totalRequests).toBe(1);
      expect(metricsData.slowQueries.length).toBe(1);
      
      metrics.reset();
      
      metricsData = metrics.getMetrics();
      expect(metricsData.totalRequests).toBe(0);
      expect(metricsData.slowQueries.length).toBe(0);
      expect(metricsData.averageResponseTime).toBe(0);
    });
  });
});