import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { registerRoutes } from '../routes';

let app: express.Express;
let server: import('http').Server;

describe("CSRF Protection Integration", () => {
  beforeAll(async () => {
    // Set required environment variables for tests
    process.env.DATABASE_URL = 'postgres://test:test@localhost/testdb';
    process.env.JWT_SECRET = 'test-jwt-secret-for-csrf-integration-tests-12345678';
    process.env.NODE_ENV = 'test';
    
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    server = await registerRoutes(app);
  });

  afterAll(() => {
    server?.close();
  });

  it("should allow POST operations with valid CSRF token", async () => {
    // Register and login
    const email = `test-${Date.now()}@gmail.com`;
    const password = 'Strong1234';
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test', email, password, role: 'admin' })
      .expect(201);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);

    const cookies = loginRes.headers['set-cookie'] as unknown as string[];
    
    // Get CSRF token via new endpoint
    const csrfRes = await request(app)
      .get('/api/csrf-token')
      .set('Cookie', cookies)
      .expect(200);

    const csrfToken = csrfRes.body.token;
    expect(csrfToken).toBeTruthy();

    // Test POST operation with CSRF token
    await request(app)
      .post('/api/clients')
      .set('Cookie', cookies)
      .set('X-CSRF-Token', csrfToken)
      .send({ name: 'Test Client', company: 'Test Corp', email: 'client@gmail.com' })
      .expect(201);
  });

  it("should reject POST operations without CSRF token", async () => {
    // Register and login
    const email = `test-${Date.now()}@gmail.com`;
    const password = 'Strong1234';
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test', email, password, role: 'admin' })
      .expect(201);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);

    const cookies = loginRes.headers['set-cookie'] as unknown as string[];

    // Test POST operation without CSRF token
    const res = await request(app)
      .post('/api/clients')
      .set('Cookie', cookies)
      .send({ name: 'Test Client', company: 'Test Corp', email: 'client@gmail.com' })
      .expect(403);

    expect(res.body.message).toBe("CSRF invalide");
  });

  it("should reject POST operations with invalid CSRF token", async () => {
    // Register and login
    const email = `test-${Date.now()}@gmail.com`;
    const password = 'Strong1234';
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test', email, password, role: 'admin' })
      .expect(201);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);

    const cookies = loginRes.headers['set-cookie'] as unknown as string[];

    // Test POST operation with invalid CSRF token
    const res = await request(app)
      .post('/api/clients')
      .set('Cookie', cookies)
      .set('X-CSRF-Token', 'invalid-token')
      .send({ name: 'Test Client', company: 'Test Corp', email: 'client@gmail.com' })
      .expect(403);

    expect(res.body.message).toBe("CSRF invalide");
  });
});