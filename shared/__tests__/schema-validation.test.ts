import { describe, it, expect } from 'vitest';
import {
  insertClientSchema,
  insertQuoteSchema,
  insertUserSchema,
} from '../schema';

describe('Enhanced Schema Validation', () => {
  describe('insertClientSchema', () => {
    it('should accept valid client data with enhanced email validation', () => {
      const validClient = {
        name: 'Jean Dupont',
        company: 'ACME Corp',
        email: 'jean.dupont@acme-corp.fr',
        phone: '+33 1 23 45 67 89',
        position: 'Directeur'
      };

      expect(() => insertClientSchema.parse(validClient)).not.toThrow();
    });

    it('should reject invalid email formats', () => {
      const invalidClient = {
        name: 'Jean Dupont',
        company: 'ACME Corp',
        email: 'invalid@example.com', // Blocked domain
        phone: '+33 1 23 45 67 89',
        position: 'Directeur'
      };

      expect(() => insertClientSchema.parse(invalidClient)).toThrow();
    });

    it('should reject malformed emails', () => {
      const invalidClient = {
        name: 'Jean Dupont',
        company: 'ACME Corp',
        email: 'user..double@domain.com', // Double dots
        phone: '+33 1 23 45 67 89',
        position: 'Directeur'
      };

      expect(() => insertClientSchema.parse(invalidClient)).toThrow();
    });
  });

  describe('insertQuoteSchema', () => {
    it('should accept valid quote data with enhanced validation', () => {
      const validQuote = {
        reference: 'DEVIS-2024-001',
        clientId: 'client-123',
        description: 'Développement application web',
        amount: '15 000.00',
        sentDate: '2024-01-10', // Past date
        notes: 'Urgent'
      };

      const result = insertQuoteSchema.parse(validQuote);
      expect(result.amount).toBe('15000.00'); // Normalized amount
      expect(result.sentDate).toBe('2024-01-10'); // Date format preserved
    });

    it('should accept French amount formats', () => {
      const quoteWithFrenchAmount = {
        reference: 'DEVIS-2024-002',
        clientId: 'client-123',
        description: 'Consultation',
        amount: '1 500,50', // French format
        sentDate: '2024-01-10',
      };

      const result = insertQuoteSchema.parse(quoteWithFrenchAmount);
      expect(result.amount).toBe('1500.50'); // Normalized to dot decimal
    });

    it('should accept various date formats', () => {
      const quoteWithFrenchDate = {
        reference: 'DEVIS-2024-003',
        clientId: 'client-123',
        description: 'Formation',
        amount: '2000.00',
        sentDate: '10/01/2024', // French date format
      };

      const result = insertQuoteSchema.parse(quoteWithFrenchDate);
      expect(result.sentDate).toBe('2024-01-10'); // Normalized to ISO
    });

    it('should reject invalid amount formats', () => {
      const invalidQuote = {
        reference: 'DEVIS-2024-004',
        clientId: 'client-123',
        description: 'Test',
        amount: '12.34.56', // Invalid format
        sentDate: '2024-01-10',
      };

      expect(() => insertQuoteSchema.parse(invalidQuote)).toThrow();
    });

    it('should reject future dates for sentDate', () => {
      const invalidQuote = {
        reference: 'DEVIS-2024-005',
        clientId: 'client-123',
        description: 'Test',
        amount: '1000.00',
        sentDate: '2025-12-31', // Future date
      };

      expect(() => insertQuoteSchema.parse(invalidQuote)).toThrow();
    });

    it('should handle optional dates correctly', () => {
      const quoteWithOptionalDates = {
        reference: 'DEVIS-2024-006',
        clientId: 'client-123',
        description: 'Test',
        amount: '1000.00',
        sentDate: '2024-01-10',
        plannedFollowUpDate: '15/01/2024',
        acceptedAt: '20/01/2024'
      };

      const result = insertQuoteSchema.parse(quoteWithOptionalDates);
      expect(result.plannedFollowUpDate).toBe('2024-01-15');
      expect(result.acceptedAt).toBe('2024-01-20');
    });
  });

  describe('insertUserSchema', () => {
    it('should accept valid user data with enhanced email validation', () => {
      const validUser = {
        name: 'Marie Martin',
        email: 'marie.martin@entreprise.fr',
        password: 'SecretPass123',
        role: 'manager' as const
      };

      expect(() => insertUserSchema.parse(validUser)).not.toThrow();
    });

    it('should reject invalid email domains', () => {
      const invalidUser = {
        name: 'Test User',
        email: 'test@10minutemail.com', // Temporary email domain
        password: 'SecretPass123',
        role: 'sales' as const
      };

      expect(() => insertUserSchema.parse(invalidUser)).toThrow();
    });

    it('should maintain existing password validation', () => {
      const invalidUser = {
        name: 'Test User',
        email: 'test@company.fr',
        password: 'weak', // Too short, no uppercase, no number
        role: 'sales' as const
      };

      expect(() => insertUserSchema.parse(invalidUser)).toThrow();
    });
  });

  describe('Data normalization and transformation', () => {
    it('should normalize amounts correctly for different input formats', () => {
      const testCases = [
        { input: '1000', expected: '1000' },
        { input: '1000.50', expected: '1000.50' },
        { input: '1000,50', expected: '1000.50' },
        { input: '1 000.50', expected: '1000.50' },
        { input: '12,345.67', expected: '12345.67' },
        { input: '12.345,67', expected: '12345.67' }, // European format
      ];

      testCases.forEach(({ input, expected }) => {
        const quote = {
          reference: 'TEST',
          clientId: 'client-123',
          description: 'Test',
          amount: input,
          sentDate: '2024-01-10',
        };

        const result = insertQuoteSchema.parse(quote);
        expect(result.amount).toBe(expected);
      });
    });

    it('should normalize dates correctly for different input formats', () => {
      const testCases = [
        { input: '2024-01-15', expected: '2024-01-15' },
        { input: '15/01/2024', expected: '2024-01-15' },
        { input: '15-01-2024', expected: '2024-01-15' },
        { input: '15.01.2024', expected: '2024-01-15' },
      ];

      testCases.forEach(({ input, expected }) => {
        const quote = {
          reference: 'TEST',
          clientId: 'client-123',
          description: 'Test',
          amount: '1000.00',
          sentDate: input,
        };

        const result = insertQuoteSchema.parse(quote);
        expect(result.sentDate).toBe(expected);
      });
    });
  });
});