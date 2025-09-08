import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { registerRoutes } from '../routes';

let app: express.Express;
let server: import('http').Server;

describe('Authentication Security', () => {
  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    
    // Add security headers middleware for testing
    if (process.env.NODE_ENV === "production") {
      app.use((req, res, next) => {
        res.setHeader("X-Frame-Options", "DENY");
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("X-XSS-Protection", "1; mode=block");
        res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
        res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'");
        next();
      });
    }
    
    server = await registerRoutes(app);
  });

  afterAll(async () => {
    server.close();
  });

  it('sets secure cookie attributes for JWT tokens', async () => {
    // register
    const email = `security-test@example.com`;
    const password = 'Strong1234';
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Security Test', email, password, role: 'admin' })
      .expect(201);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);

    const cookies = loginRes.headers['set-cookie'] as string[] | undefined;
    expect(cookies).toBeTruthy();
    expect(Array.isArray(cookies)).toBe(true);
    
    const tokenCookie = cookies!.find((c: string) => c.startsWith('crm_token='));
    const csrfCookie = cookies!.find((c: string) => c.startsWith('csrf_token='));
    
    expect(tokenCookie).toBeTruthy();
    expect(csrfCookie).toBeTruthy();

    // Check JWT cookie security attributes
    expect(tokenCookie).toContain('HttpOnly');
    expect(tokenCookie).toContain('SameSite=Lax'); // Should be Lax in development
    expect(tokenCookie).not.toContain('Secure'); // Should not be Secure in development
    
    // Check CSRF cookie attributes  
    expect(csrfCookie).not.toContain('HttpOnly'); // CSRF token should be accessible to JS
    expect(csrfCookie).toContain('SameSite=Lax');
  });

  it('validates JWT token expiration is reasonable', async () => {
    // In development, tokens should last 7 days, in production they should be shorter
    const email = `expiration-test@example.com`;
    const password = 'Strong1234';
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Expiration Test', email, password, role: 'admin' })
      .expect(201);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);

    const cookies = loginRes.headers['set-cookie'] as string[] | undefined;
    const tokenCookie = cookies!.find((c: string) => c.startsWith('crm_token='));
    
    expect(tokenCookie).toBeTruthy();
    
    // Check Max-Age is present (indicates proper expiration)
    expect(tokenCookie).toContain('Max-Age=');
    
    // In development mode, should be 7 days (604800 seconds)
    if (process.env.NODE_ENV !== 'production') {
      expect(tokenCookie).toContain('Max-Age=604800');
    }
  });

  it('properly clears cookies on logout', async () => {
    const email = `logout-test@example.com`;
    const password = 'Strong1234';
    
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Logout Test', email, password, role: 'admin' })
      .expect(201);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);

    const loginCookies = loginRes.headers['set-cookie'] as string[];
    
    // Extract CSRF token for logout request
    const csrfCookie = loginCookies.find((c: string) => c.startsWith('csrf_token='));
    const csrf = /csrf_token=([^;]+)/.exec(csrfCookie!)![1];
    
    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', loginCookies)
      .set('X-CSRF-Token', decodeURIComponent(csrf))
      .expect(200);

    const logoutCookies = logoutRes.headers['set-cookie'] as string[] | undefined;
    expect(logoutCookies).toBeTruthy();
    
    // Check that cookies are being cleared
    const clearedTokenCookie = logoutCookies!.find((c: string) => c.startsWith('crm_token='));
    const clearedCsrfCookie = logoutCookies!.find((c: string) => c.startsWith('csrf_token='));
    
    expect(clearedTokenCookie).toBeTruthy();
    expect(clearedCsrfCookie).toBeTruthy();
    
    // Cleared cookies should have empty values and past expiration
    expect(clearedTokenCookie).toContain('crm_token=;');
    expect(clearedCsrfCookie).toContain('csrf_token=;');
  });
});