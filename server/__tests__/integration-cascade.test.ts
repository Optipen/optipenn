import { describe, it, expect } from 'vitest';
import { MemStorage } from '../storage';

describe('Integration: Complete Cascade Deletion Flow', () => {
  it('should handle complex real-world cascade deletion scenario', async () => {
    const storage = new MemStorage();
    
    // Create multiple clients with interconnected data
    const clients = await Promise.all([
      storage.createClient({
        name: 'Alice Johnson',
        company: 'TechCorp',
        email: 'alice@techcorp.com',
        phone: '+1234567890',
        position: 'CTO'
      }),
      storage.createClient({
        name: 'Bob Smith', 
        company: 'InnovateLtd',
        email: 'bob@innovate.com',
        phone: '+1987654321',
        position: 'Manager'
      })
    ]);

    // Create quotes for both clients
    const quotes = await Promise.all([
      // Alice's quotes
      storage.createQuote({
        reference: 'TECH-2024-001',
        clientId: clients[0].id,
        description: 'Cloud migration project',
        amount: '50000.00',
        sentDate: '2024-01-01',
        status: 'Envoyé'
      }),
      storage.createQuote({
        reference: 'TECH-2024-002',
        clientId: clients[0].id,
        description: 'Security audit',
        amount: '15000.00',
        sentDate: '2024-01-15',
        status: 'Accepté'
      }),
      // Bob's quotes
      storage.createQuote({
        reference: 'INNO-2024-001',
        clientId: clients[1].id,
        description: 'Software development',
        amount: '25000.00',
        sentDate: '2024-02-01',
        status: 'Relancé'
      })
    ]);

    // Create follow-ups for quotes
    const followUps = await Promise.all([
      // Alice's follow-ups
      storage.createFollowUp({
        quoteId: quotes[0].id,
        date: '2024-01-08',
        comment: 'Initial follow-up call - positive feedback'
      }),
      storage.createFollowUp({
        quoteId: quotes[0].id,
        date: '2024-01-15',
        comment: 'Sent additional technical details'
      }),
      storage.createFollowUp({
        quoteId: quotes[1].id,
        date: '2024-01-22',
        comment: 'Quote accepted, project starts next month'
      }),
      // Bob's follow-ups
      storage.createFollowUp({
        quoteId: quotes[2].id,
        date: '2024-02-08',
        comment: 'Awaiting budget approval'
      }),
      storage.createFollowUp({
        quoteId: quotes[2].id,
        date: '2024-02-15',
        comment: 'Budget approved, finalizing contract'
      })
    ]);

    // Verify initial state - all data exists
    expect(await storage.getClients()).toHaveLength(2);
    expect(await storage.getQuotes()).toHaveLength(3);
    expect(await storage.getFollowUps(quotes[0].id)).toHaveLength(2);
    expect(await storage.getFollowUps(quotes[1].id)).toHaveLength(1);
    expect(await storage.getFollowUps(quotes[2].id)).toHaveLength(2);

    // Test 1: Delete specific quote - should only affect that quote's follow-ups
    const deleteQuoteResult = await storage.deleteQuote(quotes[0].id);
    expect(deleteQuoteResult).toBe(true);

    // Verify selective deletion
    expect(await storage.getClients()).toHaveLength(2); // Both clients remain
    expect(await storage.getQuotes()).toHaveLength(2); // 2 quotes remain
    expect(await storage.getFollowUps(quotes[0].id)).toHaveLength(0); // Quote 0 follow-ups deleted
    expect(await storage.getFollowUps(quotes[1].id)).toHaveLength(1); // Quote 1 follow-ups remain
    expect(await storage.getFollowUps(quotes[2].id)).toHaveLength(2); // Quote 2 follow-ups remain

    // Test 2: Delete entire client - should cascade to all remaining quotes and follow-ups
    const deleteClientResult = await storage.deleteClientWithData(clients[0].id);
    expect(deleteClientResult).toBe(true);

    // Verify complete cascade deletion for Alice
    expect(await storage.getClient(clients[0].id)).toBeUndefined(); // Alice deleted
    expect(await storage.getClient(clients[1].id)).toBeDefined(); // Bob remains
    expect(await storage.getQuotes()).toHaveLength(1); // Only Bob's quote remains
    expect(await storage.getFollowUps(quotes[1].id)).toHaveLength(0); // Alice's remaining follow-ups deleted
    expect(await storage.getFollowUps(quotes[2].id)).toHaveLength(2); // Bob's follow-ups remain

    // Test 3: Verify final state consistency
    const remainingQuotes = await storage.getQuotes();
    expect(remainingQuotes).toHaveLength(1);
    expect(remainingQuotes[0].reference).toBe('INNO-2024-001');
    expect(remainingQuotes[0].clientId).toBe(clients[1].id);

    // Test 4: Clean up remaining data
    const finalDeleteResult = await storage.deleteClient(clients[1].id);
    expect(finalDeleteResult).toBe(true);

    // Verify complete cleanup
    expect(await storage.getClients()).toHaveLength(0);
    expect(await storage.getQuotes()).toHaveLength(0);
    expect(await storage.getFollowUps(quotes[2].id)).toHaveLength(0);
  });

  it('should demonstrate transactional-like behavior with error recovery', async () => {
    const storage = new MemStorage();
    
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

    // Test error handling - attempt to delete non-existent data
    const nonExistentResult = await storage.deleteClient('non-existent-id');
    expect(nonExistentResult).toBe(false);

    // Verify original data is untouched after failed operation
    expect(await storage.getClient(client.id)).toBeDefined();
    expect(await storage.getQuote(quote.id)).toBeDefined();

    // Test successful deletion
    const successResult = await storage.deleteClient(client.id);
    expect(successResult).toBe(true);

    // Verify successful cascade deletion
    expect(await storage.getClient(client.id)).toBeUndefined();
    expect(await storage.getQuote(quote.id)).toBeUndefined();
  });
});