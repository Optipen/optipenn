import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDb, withSafeDelete } from '../db';
import { storage } from '../storage';
import { clients, quotes, followUps } from '../../shared/schema';
import { eq } from 'drizzle-orm';

describe('Transactional Cascade Deletion', () => {
  let testClientId: string;
  let testQuoteId: string;
  let testFollowUpId: string;

  beforeEach(async () => {
    // Set up test environment
    process.env.DATABASE_URL = 'postgres://test:test@localhost/testdb';
    process.env.JWT_SECRET = 'test-jwt-secret-cascade-12345678';
    process.env.NODE_ENV = 'test';
    
    // Skip test setup if database is not available
    const db = getDb();
    if (!db) return;
    
    try {
      // Create test data
      const client = await storage.createClient({
        name: 'Test Client',
        company: 'Test Company',
        email: 'test@cascade.com',
        phone: '1234567890',
        position: 'Manager'
      });
      testClientId = client.id;

      const quote = await storage.createQuote({
        reference: 'TEST-CASCADE-001',
        clientId: testClientId,
        description: 'Test quote for cascade deletion',
        amount: '1000.00',
        sentDate: '2024-01-01'
      });
      testQuoteId = quote.id;

      const followUp = await storage.createFollowUp({
        quoteId: testQuoteId,
        date: '2024-01-08',
        comment: 'First follow-up'
      });
      testFollowUpId = followUp.id;
    } catch (error) {
      console.log('Failed to set up test data:', error);
    }
  });

  afterEach(async () => {
    // Clean up test data if it still exists
    const db = getDb();
    if (db && testClientId) {
      try {
        await db.delete(followUps).where(eq(followUps.id, testFollowUpId));
        await db.delete(quotes).where(eq(quotes.id, testQuoteId));
        await db.delete(clients).where(eq(clients.id, testClientId));
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
  });

  it('should delete client and cascade to quotes and follow-ups transactionally', async () => {
    const db = getDb();
    if (!db) {
      console.log('Database not available, skipping test');
      return;
    }

    // Verify data exists before deletion
    const clientBefore = await storage.getClient(testClientId);
    const quoteBefore = await storage.getQuote(testQuoteId);
    const followUpsBefore = await storage.getFollowUps(testQuoteId);

    expect(clientBefore).toBeDefined();
    expect(quoteBefore).toBeDefined();
    expect(followUpsBefore).toHaveLength(1);

    // Perform cascade deletion
    const deleted = await storage.deleteClient(testClientId);
    expect(deleted).toBe(true);

    // Verify cascade deletion worked
    const clientAfter = await storage.getClient(testClientId);
    const quoteAfter = await storage.getQuote(testQuoteId);
    const followUpsAfter = await storage.getFollowUps(testQuoteId);

    expect(clientAfter).toBeUndefined();
    expect(quoteAfter).toBeUndefined();
    expect(followUpsAfter).toHaveLength(0);
  });

  it('should delete quote and cascade to follow-ups transactionally', async () => {
    const db = getDb();
    if (!db) {
      console.log('Database not available, skipping test');
      return;
    }

    // Verify data exists before deletion
    const quoteBefore = await storage.getQuote(testQuoteId);
    const followUpsBefore = await storage.getFollowUps(testQuoteId);

    expect(quoteBefore).toBeDefined();
    expect(followUpsBefore).toHaveLength(1);

    // Perform cascade deletion
    const deleted = await storage.deleteQuote(testQuoteId);
    expect(deleted).toBe(true);

    // Verify cascade deletion worked (quote and follow-ups deleted, client remains)
    const clientAfter = await storage.getClient(testClientId);
    const quoteAfter = await storage.getQuote(testQuoteId);
    const followUpsAfter = await storage.getFollowUps(testQuoteId);

    expect(clientAfter).toBeDefined(); // Client should still exist
    expect(quoteAfter).toBeUndefined();
    expect(followUpsAfter).toHaveLength(0);
  });

  it('should handle non-existent client deletion gracefully', async () => {
    const db = getDb();
    if (!db) {
      console.log('Database not available, skipping test');
      return;
    }

    const fakeId = 'non-existent-id';
    const deleted = await storage.deleteClient(fakeId);
    expect(deleted).toBe(false);
  });

  it('should handle non-existent quote deletion gracefully', async () => {
    const db = getDb();
    if (!db) {
      console.log('Database not available, skipping test');
      return;
    }

    const fakeId = 'non-existent-id';
    const deleted = await storage.deleteQuote(fakeId);
    expect(deleted).toBe(false);
  });

  it('should use deleteClientWithData for enhanced cascade deletion', async () => {
    const db = getDb();
    if (!db) {
      console.log('Database not available, skipping test');
      return;
    }

    // Verify data exists before deletion
    const clientBefore = await storage.getClient(testClientId);
    const quotesBefore = await storage.getQuotesByClientId(testClientId);

    expect(clientBefore).toBeDefined();
    expect(quotesBefore).toHaveLength(1);

    // Perform enhanced cascade deletion
    const deleted = await storage.deleteClientWithData(testClientId);
    expect(deleted).toBe(true);

    // Verify all related data is deleted
    const clientAfter = await storage.getClient(testClientId);
    const quotesAfter = await storage.getQuotesByClientId(testClientId);

    expect(clientAfter).toBeUndefined();
    expect(quotesAfter).toHaveLength(0);
  });

  it('should handle error recovery and data integrity', async () => {
    const db = getDb();
    if (!db) {
      console.log('Database not available, skipping test');
      return;
    }

    // Test data integrity with error handling
    try {
      await withSafeDelete(db, async (db) => {
        // This should work fine - client exists
        const [existingClient] = await db.select().from(clients).where(eq(clients.id, testClientId));
        expect(existingClient).toBeDefined();
        
        // Simulate checking constraints before deletion
        const clientQuotes = await db.select().from(quotes).where(eq(quotes.clientId, testClientId));
        expect(clientQuotes.length).toBeGreaterThan(0);
        
        return true;
      });
    } catch (error) {
      expect(true).toBe(false); // Should not throw
    }

    // Verify that the client still exists after the check
    const clientAfter = await storage.getClient(testClientId);
    expect(clientAfter).toBeDefined();
  });
});