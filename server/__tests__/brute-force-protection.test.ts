import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request, { Response } from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { registerRoutes } from '../routes';

let app: express.Express;
let server: import('http').Server;

describe('Brute-force Protection', () => {
  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    
    server = await registerRoutes(app);
  });

  afterAll(async () => {
    server.close();
  });

  it('limits excessive login attempts from same IP', async () => {
    const email = 'brute-force-test@example.com';
    const password = 'Strong1234';
    
    // First register a user
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Brute Force Test', email, password, role: 'admin' })
      .expect(201);

    // Try to login with wrong password multiple times
    const wrongPassword = 'wrongpassword';
    const responses: Response[] = [];
    
    // Make multiple failed login attempts (more than the rate limit)
    for (let i = 0; i < 15; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email, password: wrongPassword });
      responses.push(res);
    }

    // First several attempts should be 401 (unauthorized)
    const unauthorizedResponses = responses.filter(res => res.status === 401);
    expect(unauthorizedResponses.length).toBeGreaterThan(0);

    // After rate limit is exceeded, should get 429 (too many requests)
    const rateLimitResponses = responses.filter(res => res.status === 429);
    expect(rateLimitResponses.length).toBeGreaterThan(0);

    // Check that rate limit error message is in French
    if (rateLimitResponses.length > 0) {
      expect(rateLimitResponses[0].body.message).toContain('tentatives');
    }
  });

  it('limits excessive registration attempts from same IP', async () => {
    const responses: Response[] = [];
    
    // Make multiple registration attempts (more than the rate limit of 10)
    for (let i = 0; i < 15; i++) {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ 
          name: `Registration Test ${i}`, 
          email: `register-test-mass-${Date.now()}-${i}@example.com`, 
          password: 'Strong1234', 
          role: 'admin' 
        });
      responses.push(res);
    }

    // Count different response types
    const successfulResponses = responses.filter(res => res.status === 201);
    const rateLimitResponses = responses.filter(res => res.status === 429);
    
    // Should have some successful registrations at the beginning
    expect(successfulResponses.length).toBeGreaterThan(0);
    
    // Should hit rate limit eventually
    expect(rateLimitResponses.length).toBeGreaterThan(0);

    // Check that rate limit error message is in French
    if (rateLimitResponses.length > 0) {
      expect(rateLimitResponses[0].body.message).toContain('inscription');
    }
  });

  it('allows successful login after few failed attempts', async () => {
    const email = 'success-after-fail@example.com';
    const correctPassword = 'Strong1234';
    const wrongPassword = 'wrongpassword';
    
    // Register a user
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Success Test', email, password: correctPassword, role: 'admin' })
      .expect(201);

    // Make only a couple of failed attempts (well below rate limiting thresholds)
    await request(app)
      .post('/api/auth/login')
      .send({ email, password: wrongPassword })
      .expect(401);

    await request(app)
      .post('/api/auth/login')
      .send({ email, password: wrongPassword })
      .expect(401);

    // Now try with correct password - should still work
    const successResponse = await request(app)
      .post('/api/auth/login')
      .send({ email, password: correctPassword });

    expect(successResponse.status).toBe(200);
    expect(successResponse.body.message).toBe('Connecté');
  });

  it('provides appropriate error messages for rate limiting', async () => {
    const responses: Response[] = [];
    
    // Make many login attempts to trigger rate limiting
    for (let i = 0; i < 12; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'wrongpassword' });
      responses.push(res);
    }

    // Find rate-limited responses
    const rateLimitedResponses = responses.filter(res => res.status === 429);
    
    if (rateLimitedResponses.length > 0) {
      const rateLimitResponse = rateLimitedResponses[0];
      
      // Should have French error message
      expect(rateLimitResponse.body.message).toBeDefined();
      expect(typeof rateLimitResponse.body.message).toBe('string');
      expect(rateLimitResponse.body.message.length).toBeGreaterThan(0);
      
      // Should include information about timing
      const message = rateLimitResponse.body.message.toLowerCase();
      expect(message).toMatch(/minutes?|heure/);
    }
  });

  it('includes rate limit headers in responses', async () => {
    const email = 'rate-headers@example.com';
    const password = 'Strong1234';
    
    // Register a user
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Rate Headers Test', email, password, role: 'admin' })
      .expect(201);

    // Make a login attempt and check headers
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email, password });

    // Should have rate limit headers (from express-rate-limit with standardHeaders: true)
    expect(response.headers).toHaveProperty('ratelimit-limit');
    expect(response.headers).toHaveProperty('ratelimit-remaining');
    expect(response.headers).toHaveProperty('ratelimit-reset');
  });
});