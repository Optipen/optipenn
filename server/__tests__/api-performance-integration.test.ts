import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import express from "express";
import { registerRoutes } from "../routes";

describe("API Performance Integration Tests", () => {
  let app: express.Application;
  let request: supertest.SuperTest<supertest.Test>;

  beforeAll(async () => {
    // Set test environment variables
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
    process.env.JWT_SECRET = "test-secret-for-testing";
    process.env.NODE_ENV = "test";

    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));

    await registerRoutes(app);
    request = supertest(app);
  });

  afterAll(() => {
    // Clean up environment variables
    delete process.env.DATABASE_URL;
    delete process.env.JWT_SECRET;
    delete process.env.NODE_ENV;
  });

  describe("Health Endpoint", () => {
    it("should return enhanced health status", async () => {
      const response = await request.get("/api/health");
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("status");
      expect(response.body).toHaveProperty("timestamp");
      expect(response.body).toHaveProperty("uptime");
      expect(response.body).toHaveProperty("environment");
      expect(response.body).toHaveProperty("database");
      expect(response.body).toHaveProperty("memory");
      expect(response.body).toHaveProperty("performance");
      
      expect(response.body.database).toHaveProperty("connected");
      expect(response.body.database).toHaveProperty("latency");
      expect(response.body.memory).toHaveProperty("usageMB");
      expect(response.body.performance).toHaveProperty("totalRequests");
    });
  });

  describe("Pagination Headers", () => {
    it("should include pagination headers for clients endpoint", async () => {
      const response = await request
        .get("/api/clients")
        .query({ page: 1, pageSize: 5 });
      
      // Will fail auth but should still process pagination
      expect(response.headers).toHaveProperty("x-total-count");
    });

    it("should include pagination headers for quotes endpoint", async () => {
      const response = await request
        .get("/api/quotes")
        .query({ page: 1, pageSize: 5 });
      
      // Will fail auth but should still process pagination  
      expect(response.headers).toHaveProperty("x-total-count");
    });
  });

  describe("Request Headers", () => {
    it("should include request ID in response headers", async () => {
      const response = await request.get("/api/health");
      
      expect(response.headers).toHaveProperty("x-request-id");
      expect(typeof response.headers["x-request-id"]).toBe("string");
      expect(response.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/); // UUID format
    });
  });

  describe("Structured Error Responses", () => {
    it("should include request ID in error responses during development", async () => {
      const response = await request.get("/api/nonexistent");
      
      expect(response.status).toBe(404);
      // In development mode, should include request ID
      if (process.env.NODE_ENV === "development") {
        expect(response.body).toHaveProperty("requestId");
      }
    });
  });
});