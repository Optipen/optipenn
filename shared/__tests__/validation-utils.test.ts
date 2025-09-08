import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  strictEmailValidation,
  strictAmountValidation,
  strictDateValidation,
  pastDateValidation,
  futureDateValidation,
  optionalStrictDateValidation,
  dateRangeValidation,
  TimezoneUtils,
  formatUtils,
  DEFAULT_TIMEZONE
} from '../validation-utils';

describe('Enhanced Validation Utils', () => {
  describe('strictEmailValidation', () => {
    it('should accept valid email addresses', () => {
      const validEmails = [
        'user@example.fr',
        'test.email@domain.com',
        'user+tag@company.org',
        'firstname.lastname@enterprise.co.uk',
        'user123@domain-name.com'
      ];

      validEmails.forEach(email => {
        expect(() => strictEmailValidation.parse(email)).not.toThrow();
      });
    });

    it('should reject invalid email formats', () => {
      const invalidEmails = [
        '',
        'not-an-email',
        '@domain.com',
        'user@',
        'user..double@domain.com',
        '.user@domain.com',
        'user.@domain.com',
        'user@domain',
        'user@-domain.com',
        'user@domain-.com',
        'user@.domain.com',
        'user@domain..com'
      ];

      invalidEmails.forEach(email => {
        expect(() => strictEmailValidation.parse(email)).toThrow();
      });
    });

    it('should reject suspicious domains', () => {
      const suspiciousEmails = [
        'test@example.com',
        'user@localhost',
        'temp@10minutemail.com',
        'fake@tempmail.org'
      ];

      suspiciousEmails.forEach(email => {
        expect(() => strictEmailValidation.parse(email)).toThrow();
      });
    });

    it('should reject emails that are too long', () => {
      const longEmail = 'a'.repeat(250) + '@domain.com';
      expect(() => strictEmailValidation.parse(longEmail)).toThrow();
    });

    it('should reject local part that is too long', () => {
      const longLocalPart = 'a'.repeat(65) + '@domain.com';
      expect(() => strictEmailValidation.parse(longLocalPart)).toThrow();
    });
  });

  describe('strictAmountValidation', () => {
    it('should accept valid amount formats', () => {
      const validAmounts = [
        '100',
        '100.00',
        '100,50',
        '1000.99',
        '12 000.00',
        '12,000.50',
        '999999999.99'
      ];

      validAmounts.forEach(amount => {
        const result = strictAmountValidation.parse(amount);
        expect(typeof result).toBe('string');
        expect(parseFloat(result)).toBeGreaterThanOrEqual(0);
      });
    });

    it('should normalize amount format', () => {
      expect(strictAmountValidation.parse('12 000,50')).toBe('12000.50');
      expect(strictAmountValidation.parse('1,000.99')).toBe('1000.99');
      expect(strictAmountValidation.parse('100,50')).toBe('100.50');
      expect(strictAmountValidation.parse('100.50')).toBe('100.50');
    });

    it('should reject invalid amount formats', () => {
      const invalidAmounts = [
        '',
        'not-a-number',
        '100.123', // trop de décimales
        '-100', // négatif
        '1000000000', // trop élevé
        '100.', // point sans décimales
        '.100', // point au début
        '100..00', // double point
        '12,34,56', // multiples virgules incorrectes
        '12.34.56' // multiples points incorrects
      ];

      invalidAmounts.forEach(amount => {
        expect(() => strictAmountValidation.parse(amount)).toThrow();
      });
    });

    it('should handle edge cases', () => {
      expect(strictAmountValidation.parse('0')).toBe('0');
      expect(strictAmountValidation.parse('0.01')).toBe('0.01');
      expect(strictAmountValidation.parse('999999999.99')).toBe('999999999.99');
    });
  });

  describe('TimezoneUtils', () => {
    beforeEach(() => {
      // Mock date pour des tests cohérents
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T10:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    describe('parseFrenchDate', () => {
      it('should parse different French date formats', () => {
        const dateFormats = [
          '2024-01-15',
          '15/01/2024',
          '15-01-2024',
          '15.01.2024'
        ];

        dateFormats.forEach(dateStr => {
          const result = TimezoneUtils.parseFrenchDate(dateStr);
          expect(result).toBeInstanceOf(Date);
          expect(result.getFullYear()).toBe(2024);
          expect(result.getMonth()).toBe(0); // Janvier = 0
          expect(result.getDate()).toBe(15);
        });
      });

      it('should reject invalid date formats', () => {
        const invalidDates = [
          'invalid-date',
          '32/01/2024',
          '15/13/2024',
          '2024/01/15',
          ''
        ];

        invalidDates.forEach(dateStr => {
          expect(() => TimezoneUtils.parseFrenchDate(dateStr)).toThrow();
        });
      });
    });

    describe('formatFrench', () => {
      it('should format dates in French locale', () => {
        const date = new Date('2024-01-15T10:00:00Z');
        const formatted = TimezoneUtils.formatFrench(date);
        expect(formatted).toMatch(/15\/01\/2024/);
      });

      it('should support custom format strings', () => {
        const date = new Date('2024-01-15T10:00:00Z');
        const formatted = TimezoneUtils.formatFrench(date, 'dd-MM-yyyy');
        expect(formatted).toMatch(/15-01-2024/);
      });
    });

    describe('date comparison utilities', () => {
      it('should correctly identify past dates', () => {
        const pastDate = new Date('2024-01-14T10:00:00Z');
        expect(TimezoneUtils.isPastDate(pastDate)).toBe(true);

        const futureDate = new Date('2024-01-16T10:00:00Z');
        expect(TimezoneUtils.isPastDate(futureDate)).toBe(false);

        const today = new Date('2024-01-15T15:00:00Z');
        expect(TimezoneUtils.isPastDate(today)).toBe(false); // Same day
      });

      it('should correctly identify future dates', () => {
        const futureDate = new Date('2024-01-16T10:00:00Z');
        expect(TimezoneUtils.isFutureDate(futureDate)).toBe(true);

        const pastDate = new Date('2024-01-14T10:00:00Z');
        expect(TimezoneUtils.isFutureDate(pastDate)).toBe(false);

        const today = new Date('2024-01-15T15:00:00Z');
        expect(TimezoneUtils.isFutureDate(today)).toBe(false); // Same day
      });
    });

    describe('timezone conversion', () => {
      it('should convert to/from timezone correctly', () => {
        const utcDate = new Date('2024-01-15T10:00:00Z');
        
        // Convert to Paris timezone (UTC+1 in winter)
        const parisDate = TimezoneUtils.toTimezone(utcDate, 'Europe/Paris');
        expect(parisDate.getHours()).toBe(11); // 10 UTC + 1 hour

        // Convert back to UTC
        const backToUtc = TimezoneUtils.fromTimezone(parisDate, 'Europe/Paris');
        expect(backToUtc.getTime()).toBe(utcDate.getTime());
      });
    });
  });

  describe('strictDateValidation', () => {
    it('should accept valid date formats and normalize them', () => {
      const validDates = [
        '2024-01-15',
        '15/01/2024',
        '15-01-2024',
        '15.01.2024'
      ];

      validDates.forEach(dateStr => {
        const result = strictDateValidation.parse(dateStr);
        expect(result).toBe('2024-01-15'); // Normalized to ISO format
      });
    });

    it('should reject invalid date formats', () => {
      const invalidDates = [
        '',
        'invalid-date',
        '32/01/2024',
        '15/13/2024',
        '2024/01/15'
      ];

      invalidDates.forEach(dateStr => {
        expect(() => strictDateValidation.parse(dateStr)).toThrow();
      });
    });
  });

  describe('pastDateValidation', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T10:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should accept past dates', () => {
      const result = pastDateValidation.parse('14/01/2024');
      expect(result).toBe('2024-01-14');
    });

    it('should reject future dates', () => {
      expect(() => pastDateValidation.parse('16/01/2024')).toThrow();
    });

    it('should reject today\'s date', () => {
      // Today's date should not be considered past, so this should throw
      expect(() => pastDateValidation.parse('15/01/2024')).toThrow();
    });
  });

  describe('futureDateValidation', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T10:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should accept future dates', () => {
      const result = futureDateValidation.parse('16/01/2024');
      expect(result).toBe('2024-01-16');
    });

    it('should reject past dates', () => {
      expect(() => futureDateValidation.parse('14/01/2024')).toThrow();
    });

    it('should reject today\'s date', () => {
      expect(() => futureDateValidation.parse('15/01/2024')).toThrow();
    });
  });

  describe('optionalStrictDateValidation', () => {
    it('should accept undefined values', () => {
      const result = optionalStrictDateValidation.parse(undefined);
      expect(result).toBeUndefined();
    });

    it('should accept empty strings as undefined', () => {
      const result = optionalStrictDateValidation.parse('');
      expect(result).toBeUndefined();
    });

    it('should validate valid dates', () => {
      const result = optionalStrictDateValidation.parse('15/01/2024');
      expect(result).toBe('2024-01-15');
    });

    it('should reject invalid date formats', () => {
      expect(() => optionalStrictDateValidation.parse('invalid-date')).toThrow();
    });
  });

  describe('dateRangeValidation', () => {
    it('should accept valid date ranges', () => {
      const result = dateRangeValidation.parse({
        startDate: '14/01/2024',
        endDate: '16/01/2024'
      });
      
      expect(result.startDate).toBe('2024-01-14');
      expect(result.endDate).toBe('2024-01-16');
    });

    it('should accept same dates for start and end', () => {
      const result = dateRangeValidation.parse({
        startDate: '15/01/2024',
        endDate: '15/01/2024'
      });
      
      expect(result.startDate).toBe('2024-01-15');
      expect(result.endDate).toBe('2024-01-15');
    });

    it('should reject ranges where end date is before start date', () => {
      expect(() => dateRangeValidation.parse({
        startDate: '16/01/2024',
        endDate: '14/01/2024'
      })).toThrow();
    });
  });

  describe('formatUtils', () => {
    describe('formatAmount', () => {
      it('should format amounts in French currency format', () => {
        const result1 = formatUtils.formatAmount(1234.56);
        // Check the essential parts: contains the digits, comma as decimal separator, and Euro symbol
        expect(result1).toContain('1');
        expect(result1).toContain('234');
        expect(result1).toContain(',56');
        expect(result1).toContain('€');
        
        const result2 = formatUtils.formatAmount('1234.56');
        expect(result2).toContain('1');
        expect(result2).toContain('234');
        expect(result2).toContain(',56');
        expect(result2).toContain('€');
        
        const zeroResult = formatUtils.formatAmount(0);
        expect(zeroResult).toContain('0');
        expect(zeroResult).toContain(',00');
        expect(zeroResult).toContain('€');
      });
    });

    describe('formatDate', () => {
      it('should format dates in French format', () => {
        const date = new Date('2024-01-15T10:00:00Z');
        const formatted = formatUtils.formatDate(date);
        expect(formatted).toMatch(/15\/01\/2024/);
      });

      it('should support custom format strings', () => {
        const date = new Date('2024-01-15T10:00:00Z');
        const formatted = formatUtils.formatDate(date, 'dd-MM-yyyy');
        expect(formatted).toMatch(/15-01-2024/);
      });
    });

    describe('formatDateTime', () => {
      it('should format dates with time in French format', () => {
        const date = new Date('2024-01-15T10:30:00Z');
        const formatted = formatUtils.formatDateTime(date);
        expect(formatted).toMatch(/15\/01\/2024 \d{2}:\d{2}/);
      });
    });
  });
});