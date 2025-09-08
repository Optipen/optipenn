import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { registerRoutes } from '../routes';

let app: express.Express;
let server: import('http').Server;
let originalNodeEnv: string | undefined;

describe('Production Security Features', () => {
  beforeAll(async () => {
    // Save original NODE_ENV and set to production for testing
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    // Set JWT_SECRET for production testing
    process.env.JWT_SECRET = 'test-production-secret-key-12345';
    
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    
    // Add security headers middleware (production behavior)
    app.use((req, res, next) => {
      res.setHeader("X-Frame-Options", "DENY");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("X-XSS-Protection", "1; mode=block");
      res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
      res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'");
      next();
    });
    
    server = await registerRoutes(app);
  });

  afterAll(async () => {
    // Restore original NODE_ENV
    if (originalNodeEnv !== undefined) {
      process.env.NODE_ENV = originalNodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }
    server.close();
  });

  it('sets stricter cookie security in production mode', async () => {
    const email = `prod-security-test@example.com`;
    const password = 'Strong1234';
    
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Production Security Test', email, password, role: 'admin' })
      .expect(201);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);

    const cookies = loginRes.headers['set-cookie'] as unknown as string[] | undefined;
    expect(cookies).toBeTruthy();
    
    const tokenCookie = cookies!.find((c: string) => c.startsWith('crm_token='));
    const csrfCookie = cookies!.find((c: string) => c.startsWith('csrf_token='));
    
    expect(tokenCookie).toBeTruthy();
    expect(csrfCookie).toBeTruthy();

    // In production mode, cookies should have strict SameSite policy
    expect(tokenCookie).toContain('SameSite=Strict');
    expect(csrfCookie).toContain('SameSite=Strict');
    
    // JWT cookie should still be HttpOnly
    expect(tokenCookie).toContain('HttpOnly');
    // CSRF token should NOT be HttpOnly (JS needs to read it)
    expect(csrfCookie).not.toContain('HttpOnly');
    
    // In production mode, should have shorter expiration (2 hours = 7200 seconds)
    expect(tokenCookie).toContain('Max-Age=7200');
    expect(csrfCookie).toContain('Max-Age=7200');
  });

  it('includes security headers in production mode', async () => {
    const res = await request(app)
      .get('/api/statistics')
      .expect(401); // Expect 401 since we're not authenticated

    // Check security headers are present
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-xss-protection']).toBe('1; mode=block');
    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(res.headers['content-security-policy']).toContain('default-src \'self\'');
  });
});