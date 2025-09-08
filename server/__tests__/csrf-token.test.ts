import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { registerRoutes } from '../routes';

let app: express.Express;
let server: import('http').Server;

describe("CSRF Token Endpoint", () => {
  beforeAll(async () => {
    // Set required environment variables for tests
    process.env.DATABASE_URL = 'postgres://test:test@localhost/testdb';
    process.env.JWT_SECRET = 'test-jwt-secret-for-csrf-tests-12345678';
    process.env.NODE_ENV = 'test';
    
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    server = await registerRoutes(app);
  });

  afterAll(() => {
    server?.close();
  });

  it("should return CSRF token for authenticated user", async () => {
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
    const csrfCookie = cookies.find((c: string) => c.startsWith('csrf_token='));
    expect(csrfCookie).toBeTruthy();
    const expectedToken = /csrf_token=([^;]+)/.exec(csrfCookie!)![1];

    // Test the CSRF token endpoint
    const csrfRes = await request(app)
      .get('/api/csrf-token')
      .set('Cookie', cookies)
      .expect(200);

    expect(csrfRes.body).toHaveProperty('token');
    expect(csrfRes.body.token).toBe(decodeURIComponent(expectedToken));
  });

  it("should return 401 for unauthenticated user", async () => {
    await request(app)
      .get('/api/csrf-token')
      .expect(401);
  });

  it("should return 401 when no CSRF token cookie is available", async () => {
    // Create a user with token but without CSRF cookie (edge case)
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
    const tokenCookie = cookies.find((c: string) => c.startsWith('crm_token='));
    expect(tokenCookie).toBeTruthy();

    // Send only auth token, not CSRF token
    await request(app)
      .get('/api/csrf-token')
      .set('Cookie', [tokenCookie!])
      .expect(401);
  });
});