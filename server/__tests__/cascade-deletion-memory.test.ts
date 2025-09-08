import { describe, it, expect, beforeEach } from 'vitest';
import { MemStorage } from '../storage';

describe('In-Memory Cascade Deletion', () => {
  let storage: MemStorage;

  beforeEach(() => {
    storage = new MemStorage();
  });

  it('should cascade delete quotes and follow-ups when deleting a client', async () => {
    // Create test data
    const client = await storage.createClient({
      name: 'Test Client',
      company: 'Test Company',
      email: 'test@example.com',
      phone: '1234567890',
      position: 'Manager'
    });

    const quote = await storage.createQuote({
      reference: 'TEST-001',
      clientId: client.id,
      description: 'Test quote',
      amount: '1000.00',
      sentDate: '2024-01-01'
    });

    const followUp = await storage.createFollowUp({
      quoteId: quote.id,
      date: '2024-01-08',
      comment: 'First follow-up'
    });

    // Verify data exists
    expect(await storage.getClient(client.id)).toBeDefined();
    expect(await storage.getQuote(quote.id)).toBeDefined();
    expect(await storage.getFollowUps(quote.id)).toHaveLength(1);

    // Delete client - should cascade
    const deleted = await storage.deleteClient(client.id);
    expect(deleted).toBe(true);

    // Verify cascade deletion
    expect(await storage.getClient(client.id)).toBeUndefined();
    expect(await storage.getQuote(quote.id)).toBeUndefined();
    expect(await storage.getFollowUps(quote.id)).toHaveLength(0);
  });

  it('should cascade delete follow-ups when deleting a quote', async () => {
    // Create test data
    const client = await storage.createClient({
      name: 'Test Client',
      company: 'Test Company',
      email: 'test@example.com'
    });

    const quote = await storage.createQuote({
      reference: 'TEST-001',
      clientId: client.id,
      description: 'Test quote',
      amount: '1000.00',
      sentDate: '2024-01-01'
    });

    const followUp = await storage.createFollowUp({
      quoteId: quote.id,
      date: '2024-01-08',
      comment: 'First follow-up'
    });

    // Verify data exists
    expect(await storage.getClient(client.id)).toBeDefined();
    expect(await storage.getQuote(quote.id)).toBeDefined();
    expect(await storage.getFollowUps(quote.id)).toHaveLength(1);

    // Delete quote - should cascade to follow-ups but leave client
    const deleted = await storage.deleteQuote(quote.id);
    expect(deleted).toBe(true);

    // Verify partial cascade deletion
    expect(await storage.getClient(client.id)).toBeDefined(); // Client remains
    expect(await storage.getQuote(quote.id)).toBeUndefined();
    expect(await storage.getFollowUps(quote.id)).toHaveLength(0);
  });

  it('should handle deleteClientWithData method', async () => {
    // Create test data
    const client = await storage.createClient({
      name: 'Test Client',
      company: 'Test Company',
      email: 'test@example.com'
    });

    const quote = await storage.createQuote({
      reference: 'TEST-001',
      clientId: client.id,
      description: 'Test quote',
      amount: '1000.00',
      sentDate: '2024-01-01'
    });

    // Use enhanced deletion method
    const deleted = await storage.deleteClientWithData(client.id);
    expect(deleted).toBe(true);

    // Verify all data is deleted
    expect(await storage.getClient(client.id)).toBeUndefined();
    expect(await storage.getQuote(quote.id)).toBeUndefined();
  });

  it('should handle non-existent client deletion gracefully', async () => {
    const deleted = await storage.deleteClient('non-existent-id');
    expect(deleted).toBe(false);
  });

  it('should handle non-existent quote deletion gracefully', async () => {
    const deleted = await storage.deleteQuote('non-existent-id');
    expect(deleted).toBe(false);
  });
});