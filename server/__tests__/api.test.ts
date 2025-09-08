import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { registerRoutes } from '../routes';

let app: express.Express;
let server: import('http').Server;

describe('API', () => {
  beforeAll(async () => {
    // Set required environment variables for tests
    process.env.DATABASE_URL = 'postgres://test:test@localhost/testdb';
    process.env.JWT_SECRET = 'test-jwt-secret-for-api-tests-12345678';
    process.env.NODE_ENV = 'test';
    
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    server = await registerRoutes(app);
  });

  afterAll(async () => {
    server.close();
  });

  it('registers and logs in a user, sets cookies, and accesses protected endpoint', async () => {
    // register
    const email = `user+test@example.com`;
    const password = 'Strong1234';
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test', email, password, role: 'admin' })
      .expect(201);

    const loginRes = await request(app).post('/api/auth/login').send({ email, password }).expect(200);
    const cookies = loginRes.headers['set-cookie'] as unknown as string[];
    expect(cookies).toBeTruthy();
    const tokenCookie = cookies.find((c: string) => c.startsWith('crm_token='));
    const csrfCookie = cookies.find((c: string) => c.startsWith('csrf_token='));
    expect(tokenCookie).toBeTruthy();
    expect(csrfCookie).toBeTruthy();
    const csrf = /csrf_token=([^;]+)/.exec(csrfCookie!)![1];

    await request(app)
      .get('/api/statistics')
      .set('Cookie', cookies)
      .expect(200);

    // create a client (CSRF required)
    await request(app)
      .post('/api/clients')
      .set('Cookie', cookies)
      .set('X-CSRF-Token', decodeURIComponent(csrf))
      .send({ name: 'Jean', company: 'Acme', email: 'jean@test.fr' })
      .expect(201);
  });
});


