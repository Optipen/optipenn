import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  validateEnvironmentVariables, 
  validateEnvironmentVariablesOrThrow,
  validateSingleEnvironmentVariable,
  getSensitiveEnvironmentVariables,
  getEnvironmentVariableRule
} from '../env-validation';

describe('Environment Variables Validation', () => {
  // Store original env values
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clean env for each test
    delete process.env.DATABASE_URL;
    delete process.env.JWT_SECRET;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.CORS_ORIGIN;
    delete process.env.COOKIE_DOMAIN;
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
  });

  describe('validateEnvironmentVariables', () => {
    it('should fail validation when required variables are missing', () => {
      const result = validateEnvironmentVariables();
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Variable obligatoire manquante: DATABASE_URL - URL de connexion à la base de données');
      expect(result.errors).toContain('Variable obligatoire manquante: JWT_SECRET - Secret pour signer les tokens JWT');
      expect(result.summary.missing).toBeGreaterThan(0);
    });

    it('should pass validation with minimal required variables', () => {
      process.env.DATABASE_URL = 'postgres://user:pass@localhost/testdb';
      process.env.JWT_SECRET = 'test-secret-12345678';
      
      const result = validateEnvironmentVariables();
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.summary.validated).toBeGreaterThan(0);
    });

    it('should validate JWT_SECRET strength in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgres://user:pass@localhost/testdb';
      process.env.JWT_SECRET = 'weak'; // Too weak for production
      
      const result = validateEnvironmentVariables();
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Variable invalide: JWT_SECRET - Secret pour signer les tokens JWT');
    });

    it('should accept weaker JWT_SECRET in development/test', () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL = 'postgres://user:pass@localhost/testdb';
      process.env.JWT_SECRET = 'dev-secret';
      
      const result = validateEnvironmentVariables();
      
      expect(result.valid).toBe(true);
    });

    it('should validate DATABASE_URL format', () => {
      process.env.DATABASE_URL = 'invalid-url';
      process.env.JWT_SECRET = 'test-secret-12345678';
      
      const result = validateEnvironmentVariables();
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Variable invalide: DATABASE_URL - URL de connexion à la base de données');
    });

    it('should validate CORS_ORIGIN format', () => {
      process.env.DATABASE_URL = 'postgres://user:pass@localhost/testdb';
      process.env.JWT_SECRET = 'test-secret-12345678';
      process.env.CORS_ORIGIN = 'https://example.com,http://localhost:3000,*.badformat';
      
      const result = validateEnvironmentVariables();
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Variable invalide: CORS_ORIGIN - Origines autorisées pour CORS');
    });

    it('should accept valid CORS_ORIGIN formats', () => {
      process.env.DATABASE_URL = 'postgres://user:pass@localhost/testdb';
      process.env.JWT_SECRET = 'test-secret-12345678';
      process.env.CORS_ORIGIN = 'https://example.com,http://localhost:3000,example.org';
      
      const result = validateEnvironmentVariables();
      
      expect(result.valid).toBe(true);
    });

    it('should validate complete SMTP configuration', () => {
      process.env.DATABASE_URL = 'postgres://user:pass@localhost/testdb';
      process.env.JWT_SECRET = 'test-secret-12345678';
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_USER = 'user@example.com';
      process.env.SMTP_PASS = 'password123';
      
      const result = validateEnvironmentVariables();
      
      expect(result.valid).toBe(true);
    });

    it('should reject incomplete SMTP configuration', () => {
      process.env.DATABASE_URL = 'postgres://user:pass@localhost/testdb';
      process.env.JWT_SECRET = 'test-secret-12345678';
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_USER = 'user@example.com';
      // Missing SMTP_PASS
      
      const result = validateEnvironmentVariables();
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Configuration SMTP incomplète. Variables présentes: SMTP_HOST, SMTP_USER. Variables manquantes: SMTP_PASS');
    });

    it('should require SMTP in production mode', () => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgres://user:pass@localhost/testdb';
      process.env.JWT_SECRET = 'very-strong-production-secret-123456789';
      // No SMTP configuration
      
      const result = validateEnvironmentVariables();
      
      expect(result.warnings).toContain('Configuration SMTP manquante en production. Les notifications par email seront désactivées.');
    });

    it('should set default values for optional variables', () => {
      process.env.DATABASE_URL = 'postgres://user:pass@localhost/testdb';
      process.env.JWT_SECRET = 'test-secret-12345678';
      // NODE_ENV and PORT should get defaults
      delete process.env.NODE_ENV;
      delete process.env.PORT;
      
      const result = validateEnvironmentVariables();
      
      expect(process.env.NODE_ENV).toBe('development');
      expect(process.env.PORT).toBe('5000');
      expect(result.warnings).toContain('Variable NODE_ENV manquante, utilisation de la valeur par défaut');
      expect(result.warnings).toContain('Variable PORT manquante, utilisation de la valeur par défaut');
    });

    it('should validate PORT as number', () => {
      process.env.DATABASE_URL = 'postgres://user:pass@localhost/testdb';
      process.env.JWT_SECRET = 'test-secret-12345678';
      process.env.PORT = 'not-a-number';
      
      const result = validateEnvironmentVariables();
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Variable invalide: PORT - Port d\'écoute du serveur');
    });

    it('should mask sensitive variables in logs', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      process.env.DATABASE_URL = 'postgres://user:pass@localhost/testdb';
      process.env.JWT_SECRET = 'test-secret-12345678';
      
      validateEnvironmentVariables();
      
      const logCalls = consoleSpy.mock.calls.flat().join(' ');
      expect(logCalls).toContain('[MASQUÉ]');
      expect(logCalls).not.toContain('postgres://user:pass@localhost/testdb');
      expect(logCalls).not.toContain('test-secret-12345678');
      
      consoleSpy.mockRestore();
    });
  });

  describe('validateEnvironmentVariablesOrThrow', () => {
    it('should throw when validation fails', () => {
      // Missing required variables
      expect(() => validateEnvironmentVariablesOrThrow()).toThrow();
    });

    it('should not throw when validation passes', () => {
      process.env.DATABASE_URL = 'postgres://user:pass@localhost/testdb';
      process.env.JWT_SECRET = 'test-secret-12345678';
      
      expect(() => validateEnvironmentVariablesOrThrow()).not.toThrow();
    });

    it('should include detailed error message when throwing', () => {
      try {
        validateEnvironmentVariablesOrThrow();
        expect.fail('Should have thrown');
      } catch (error) {
        const message = (error as Error).message;
        expect(message).toContain('Échec de la validation');
        expect(message).toContain('DATABASE_URL');
        expect(message).toContain('JWT_SECRET');
      }
    });
  });

  describe('validateSingleEnvironmentVariable', () => {
    it('should validate a single variable successfully', () => {
      process.env.DATABASE_URL = 'postgres://user:pass@localhost/testdb';
      
      const result = validateSingleEnvironmentVariable('DATABASE_URL');
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should fail validation for missing required variable', () => {
      const result = validateSingleEnvironmentVariable('DATABASE_URL');
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('DATABASE_URL');
    });

    it('should fail validation for invalid variable', () => {
      process.env.DATABASE_URL = 'invalid-url';
      
      const result = validateSingleEnvironmentVariable('DATABASE_URL');
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('DATABASE_URL');
    });

    it('should return error for unknown variable', () => {
      const result = validateSingleEnvironmentVariable('UNKNOWN_VAR');
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('inconnue');
    });

    it('should handle optional variables correctly', () => {
      const result = validateSingleEnvironmentVariable('CORS_ORIGIN');
      
      expect(result.valid).toBe(true); // Optional variable missing is OK
    });
  });

  describe('getSensitiveEnvironmentVariables', () => {
    it('should return list of sensitive variables', () => {
      const sensitiveVars = getSensitiveEnvironmentVariables();
      
      expect(sensitiveVars).toContain('DATABASE_URL');
      expect(sensitiveVars).toContain('JWT_SECRET');
      expect(sensitiveVars).toContain('SMTP_HOST');
      expect(sensitiveVars).toContain('SMTP_USER');
      expect(sensitiveVars).toContain('SMTP_PASS');
      expect(sensitiveVars).not.toContain('NODE_ENV');
      expect(sensitiveVars).not.toContain('PORT');
    });
  });

  describe('getEnvironmentVariableRule', () => {
    it('should return rule for existing variable', () => {
      const rule = getEnvironmentVariableRule('DATABASE_URL');
      
      expect(rule).toBeDefined();
      expect(rule?.name).toBe('DATABASE_URL');
      expect(rule?.required).toBe(true);
      expect(rule?.sensitive).toBe(true);
    });

    it('should return undefined for non-existing variable', () => {
      const rule = getEnvironmentVariableRule('UNKNOWN_VAR');
      
      expect(rule).toBeUndefined();
    });
  });

  describe('Environment Mode Specific Validation', () => {
    it('should have stricter requirements in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgres://user:pass@localhost/testdb';
      process.env.JWT_SECRET = 'dev-secret-change'; // Not allowed in production
      
      const result = validateEnvironmentVariables();
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Variable invalide: JWT_SECRET - Secret pour signer les tokens JWT');
    });

    it('should be more lenient in development', () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL = 'postgres://user:pass@localhost/testdb';
      process.env.JWT_SECRET = 'dev-secret'; // Allowed in development
      
      const result = validateEnvironmentVariables();
      
      expect(result.valid).toBe(true);
    });

    it('should handle test environment appropriately', () => {
      process.env.NODE_ENV = 'test';
      process.env.DATABASE_URL = 'postgres://user:pass@localhost/testdb';
      process.env.JWT_SECRET = 'test-secret';
      
      const result = validateEnvironmentVariables();
      
      expect(result.valid).toBe(true);
    });
  });
});