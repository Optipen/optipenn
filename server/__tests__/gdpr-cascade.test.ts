import { describe, it, expect, beforeEach } from 'vitest';
import { MemStorage } from '../storage';

describe('GDPR Cascade Deletion Integration', () => {
  let storage: MemStorage;

  beforeEach(() => {
    storage = new MemStorage();
  });

  it('should handle GDPR client data deletion with all related records', async () => {
    // Create a client with multiple quotes and follow-ups (realistic scenario)
    const client = await storage.createClient({
      name: 'Jean Dupont',
      company: 'Société ABC',
      email: 'jean.dupont@abc.com',
      phone: '+33123456789',
      position: 'Directeur Technique'
    });

    // Create multiple quotes for this client
    const quote1 = await storage.createQuote({
      reference: 'DEV-2024-001',
      clientId: client.id,
      description: 'Développement application mobile',
      amount: '15000.00',
      sentDate: '2024-01-15',
      status: 'Envoyé'
    });

    const quote2 = await storage.createQuote({
      reference: 'DEV-2024-002', 
      clientId: client.id,
      description: 'Maintenance système existant',
      amount: '5000.00',
      sentDate: '2024-02-01',
      status: 'Accepté'
    });

    // Create follow-ups for both quotes
    const followUp1 = await storage.createFollowUp({
      quoteId: quote1.id,
      date: '2024-01-22',
      comment: 'Relance par email - pas de réponse'
    });

    const followUp2 = await storage.createFollowUp({
      quoteId: quote1.id,
      date: '2024-01-29',
      comment: 'Appel téléphonique - report décision'
    });

    const followUp3 = await storage.createFollowUp({
      quoteId: quote2.id,
      date: '2024-02-08',
      comment: 'Devis accepté - planification démarrage'
    });

    // Verify all data exists before deletion
    expect(await storage.getClient(client.id)).toBeDefined();
    expect(await storage.getQuotesByClientId(client.id)).toHaveLength(2);
    expect(await storage.getFollowUps(quote1.id)).toHaveLength(2);
    expect(await storage.getFollowUps(quote2.id)).toHaveLength(1);

    // Perform GDPR cascade deletion using enhanced method
    const deletionResult = await storage.deleteClientWithData(client.id);
    expect(deletionResult).toBe(true);

    // Verify complete cascade deletion - no client data should remain
    expect(await storage.getClient(client.id)).toBeUndefined();
    expect(await storage.getQuotesByClientId(client.id)).toHaveLength(0);
    expect(await storage.getQuote(quote1.id)).toBeUndefined();
    expect(await storage.getQuote(quote2.id)).toBeUndefined();
    expect(await storage.getFollowUps(quote1.id)).toHaveLength(0);
    expect(await storage.getFollowUps(quote2.id)).toHaveLength(0);
  });

  it('should maintain data integrity when deleting quotes independently', async () => {
    // Create client with multiple quotes
    const client = await storage.createClient({
      name: 'Marie Martin',
      company: 'Entreprise XYZ',
      email: 'marie@xyz.com'
    });

    const quote1 = await storage.createQuote({
      reference: 'PROJ-001',
      clientId: client.id,
      description: 'Projet A',
      amount: '10000.00',
      sentDate: '2024-01-01'
    });

    const quote2 = await storage.createQuote({
      reference: 'PROJ-002',
      clientId: client.id,
      description: 'Projet B', 
      amount: '20000.00',
      sentDate: '2024-02-01'
    });

    // Add follow-ups to both quotes
    await storage.createFollowUp({
      quoteId: quote1.id,
      date: '2024-01-08',
      comment: 'Suivi projet A'
    });

    await storage.createFollowUp({
      quoteId: quote2.id,
      date: '2024-02-08',
      comment: 'Suivi projet B'
    });

    // Delete only one quote - should cascade only its follow-ups
    const deleteResult = await storage.deleteQuote(quote1.id);
    expect(deleteResult).toBe(true);

    // Verify selective cascade deletion
    expect(await storage.getClient(client.id)).toBeDefined(); // Client remains
    expect(await storage.getQuote(quote1.id)).toBeUndefined(); // Quote1 deleted
    expect(await storage.getQuote(quote2.id)).toBeDefined(); // Quote2 remains
    expect(await storage.getFollowUps(quote1.id)).toHaveLength(0); // Quote1 follow-ups deleted
    expect(await storage.getFollowUps(quote2.id)).toHaveLength(1); // Quote2 follow-ups remain
    expect(await storage.getQuotesByClientId(client.id)).toHaveLength(1); // One quote remains
  });

  it('should handle edge case of deleting non-existent records gracefully', async () => {
    // Test error handling for non-existent records
    const fakeClientId = 'fake-client-123';
    const fakeQuoteId = 'fake-quote-456';

    // Should return false for non-existent records, not throw errors
    expect(await storage.deleteClient(fakeClientId)).toBe(false);
    expect(await storage.deleteClientWithData(fakeClientId)).toBe(false);
    expect(await storage.deleteQuote(fakeQuoteId)).toBe(false);

    // Verify no side effects occurred
    const allClients = await storage.getClients();
    const allQuotes = await storage.getQuotes();
    expect(allClients).toHaveLength(0);
    expect(allQuotes).toHaveLength(0);
  });
});