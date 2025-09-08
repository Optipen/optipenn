/**
 * Enhanced validation utilities for strict format validation
 * Utilitaires de validation renforcés pour une validation stricte des formats
 */

import { z } from "zod";
import { format, parseISO, isValid, addDays, startOfDay, endOfDay, parse } from "date-fns";
import { fr } from "date-fns/locale";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

// Configuration par défaut pour la timezone
export const DEFAULT_TIMEZONE = 'Europe/Paris';

/**
 * Validation d'email renforcée avec vérification de domaine
 * Enhanced email validation with domain verification
 */
export const strictEmailValidation = z
  .string()
  .min(1, "L'email est requis")
  .max(254, "L'email est trop long (max 254 caractères)")
  .refine((email) => {
    // Validation basique du format email
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return emailRegex.test(email);
  }, "Format d'email invalide")
  .refine((email) => {
    // Vérification de la partie locale (avant @)
    const [localPart, domain] = email.split('@');
    if (!localPart || localPart.length > 64) return false;
    
    // Interdire les points consécutifs
    if (localPart.includes('..')) return false;
    
    // Interdire les points au début et à la fin
    if (localPart.startsWith('.') || localPart.endsWith('.')) return false;
    
    return true;
  }, "Format de la partie locale invalide")
  .refine((email) => {
    // Vérification du domaine
    const domain = email.split('@')[1];
    if (!domain) return false;
    
    // Vérifier que le domaine contient au moins un point
    if (!domain.includes('.')) return false;
    
    // Vérifier que le domaine ne commence/finit pas par un tiret
    const domainParts = domain.split('.');
    return domainParts.every(part => 
      part.length > 0 && 
      !part.startsWith('-') && 
      !part.endsWith('-') &&
      part.length <= 63
    );
  }, "Nom de domaine invalide")
  .refine((email) => {
    // Vérifier les domaines suspects ou temporaires (basique)
    const domain = email.split('@')[1].toLowerCase();
    const suspiciousDomains = [
      'example.com', 'test.com', 'localhost',
      '10minutemail.com', 'tempmail.org', 'guerrillamail.com'
    ];
    return !suspiciousDomains.includes(domain);
  }, "Domaine email non autorisé");

/**
 * Validation de montant renforcée avec support de différents formats
 * Enhanced amount validation with support for different formats
 */
export const strictAmountValidation = z
  .string()
  .min(1, "Le montant est requis")
  .refine((amount) => {
    // Nettoyer le montant (enlever espaces)
    const cleanAmount = amount.replace(/\s/g, '');
    
    // Vérifier le format décimal plus strictement
    // Formats acceptés: 123, 123.45, 123,45, 1,234.56, 1.234,56 (européen)
    const patterns = [
      /^\d+$/, // Entier simple: 123
      /^\d+\.\d{1,2}$/, // Décimal avec point: 123.45
      /^\d+,\d{1,2}$/, // Décimal avec virgule: 123,45  
      /^\d{1,3}(,\d{3})+\.\d{1,2}$/, // US format: 1,234.56
      /^\d{1,3}(\.\d{3})+,\d{1,2}$/, // European format: 1.234,56
    ];
    
    return patterns.some(pattern => pattern.test(cleanAmount));
  }, "Format de montant invalide (ex: 12000.00, 12000,50, 12 000.00)")
  .transform((amount) => {
    // Normaliser le montant: enlever espaces, traiter les séparateurs
    let cleanAmount = amount.replace(/\s/g, '');
    
    // Si on a une virgule ET un point, déterminer le séparateur décimal
    if (cleanAmount.includes(',') && cleanAmount.includes('.')) {
      const lastCommaIndex = cleanAmount.lastIndexOf(',');
      const lastDotIndex = cleanAmount.lastIndexOf('.');
      
      // Le dernier séparateur est le décimal
      if (lastDotIndex > lastCommaIndex) {
        // Point est décimal, virgule est milliers: 1,234.56 -> 1234.56
        cleanAmount = cleanAmount.replace(/,/g, '');
      } else {
        // Virgule est décimal, point est milliers: 1.234,56 -> 1234.56
        cleanAmount = cleanAmount.replace(/\./g, '').replace(',', '.');
      }
    }
    // Si on a seulement une virgule, vérifier si c'est décimal ou milliers
    else if (cleanAmount.includes(',') && !cleanAmount.includes('.')) {
      const lastCommaIndex = cleanAmount.lastIndexOf(',');
      const afterComma = cleanAmount.substring(lastCommaIndex + 1);
      
      // Si après la virgule il y a 1-2 chiffres, c'est un séparateur décimal
      if (afterComma.length <= 2 && /^\d{1,2}$/.test(afterComma)) {
        cleanAmount = cleanAmount.replace(',', '.');
      } else {
        // Sinon, c'est un séparateur de milliers, on l'enlève
        cleanAmount = cleanAmount.replace(/,/g, '');
      }
    }
    
    return cleanAmount;
  })
  .refine((amount) => {
    const num = parseFloat(amount);
    return !isNaN(num) && isFinite(num);
  }, "Le montant doit être un nombre valide")
  .refine((amount) => {
    const num = parseFloat(amount);
    return num >= 0;
  }, "Le montant ne peut pas être négatif")
  .refine((amount) => {
    const num = parseFloat(amount);
    return num <= 999999999.99; // Limite à 999 millions
  }, "Le montant est trop élevé (max: 999,999,999.99)")
  .refine((amount) => {
    // Vérifier le nombre de décimales après normalisation
    const decimalPart = amount.split('.')[1];
    return !decimalPart || decimalPart.length <= 2;
  }, "Maximum 2 décimales autorisées");

/**
 * Utilities pour la gestion des fuseaux horaires
 * Timezone management utilities
 */
export class TimezoneUtils {
  /**
   * Convertit une date en timezone spécifique
   */
  static toTimezone(date: Date | string, timezone: string = DEFAULT_TIMEZONE): Date {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(dateObj)) {
      throw new Error('Date invalide');
    }
    return toZonedTime(dateObj, timezone);
  }

  /**
   * Convertit une date depuis une timezone vers UTC
   */
  static fromTimezone(date: Date | string, timezone: string = DEFAULT_TIMEZONE): Date {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(dateObj)) {
      throw new Error('Date invalide');
    }
    return fromZonedTime(dateObj, timezone);
  }

  /**
   * Formate une date selon la locale française avec timezone
   */
  static formatFrench(date: Date | string, formatStr: string = 'dd/MM/yyyy'): string {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(dateObj)) {
      throw new Error('Date invalide');
    }
    const zonedDate = this.toTimezone(dateObj);
    return format(zonedDate, formatStr, { locale: fr });
  }

  /**
   * Parse une date française vers UTC
   */
  static parseFrenchDate(dateStr: string, timezone: string = DEFAULT_TIMEZONE): Date {
    // Support pour plusieurs formats français
    const formats = [
      { pattern: /^\d{4}-\d{2}-\d{2}$/, format: 'yyyy-MM-dd' }, // ISO format
      { pattern: /^\d{2}\/\d{2}\/\d{4}$/, format: 'dd/MM/yyyy' },
      { pattern: /^\d{2}-\d{2}-\d{4}$/, format: 'dd-MM-yyyy' },
      { pattern: /^\d{2}\.\d{2}\.\d{4}$/, format: 'dd.MM.yyyy' }
    ];

    for (const { pattern, format: fmt } of formats) {
      if (pattern.test(dateStr.trim())) {
        try {
          let parsedDate: Date;
          
          if (fmt === 'yyyy-MM-dd') {
            parsedDate = parseISO(dateStr);
          } else {
            // Parse avec le format spécifique
            parsedDate = parse(dateStr, fmt, new Date());
          }

          if (isValid(parsedDate)) {
            // Retourner la date sans conversion timezone pour éviter les décalages
            return startOfDay(parsedDate);
          }
        } catch {
          continue;
        }
      }
    }

    throw new Error(`Format de date non reconnu: ${dateStr}`);
  }

  /**
   * Vérifie si une date est dans le futur
   */
  static isFutureDate(date: Date | string, timezone: string = DEFAULT_TIMEZONE): boolean {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(dateObj)) return false;
    
    const now = this.toTimezone(new Date(), timezone);
    const targetDate = this.toTimezone(dateObj, timezone);
    
    return startOfDay(targetDate) > startOfDay(now);
  }

  /**
   * Vérifie si une date est dans le passé
   */
  static isPastDate(date: Date | string, timezone: string = DEFAULT_TIMEZONE): boolean {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(dateObj)) return false;
    
    const now = this.toTimezone(new Date(), timezone);
    const targetDate = this.toTimezone(dateObj, timezone);
    
    return startOfDay(targetDate) < startOfDay(now);
  }

  /**
   * Obtient la date actuelle dans une timezone
   */
  static now(timezone: string = DEFAULT_TIMEZONE): Date {
    return this.toTimezone(new Date(), timezone);
  }

  /**
   * Convertit une date vers le format ISO pour stockage en base
   */
  static toISOString(date: Date | string): string {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(dateObj)) {
      throw new Error('Date invalide');
    }
    return dateObj.toISOString();
  }
}

/**
 * Validation de date renforcée avec gestion des fuseaux horaires
 * Enhanced date validation with timezone management
 */
export const strictDateValidation = z
  .string()
  .min(1, "La date est requise")
  .refine((dateStr) => {
    try {
      TimezoneUtils.parseFrenchDate(dateStr);
      return true;
    } catch {
      return false;
    }
  }, "Format de date invalide (formats acceptés: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY)")
  .transform((dateStr) => {
    // Transformer en date UTC pour stockage
    const parsedDate = TimezoneUtils.parseFrenchDate(dateStr);
    return format(parsedDate, 'yyyy-MM-dd');
  });

/**
 * Validation de date avec contrainte de date passée
 */
export const pastDateValidation = strictDateValidation
  .refine((dateStr) => {
    const date = parseISO(dateStr);
    return TimezoneUtils.isPastDate(date);
  }, "La date doit être dans le passé");

/**
 * Validation de date avec contrainte de date future
 */
export const futureDateValidation = strictDateValidation
  .refine((dateStr) => {
    const date = parseISO(dateStr);
    return TimezoneUtils.isFutureDate(date);
  }, "La date doit être dans le futur");

/**
 * Validation de date optionnelle
 */
export const optionalStrictDateValidation = z
  .string()
  .optional()
  .refine((dateStr) => {
    if (!dateStr) return true;
    try {
      TimezoneUtils.parseFrenchDate(dateStr);
      return true;
    } catch {
      return false;
    }
  }, "Format de date invalide (formats acceptés: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY)")
  .transform((dateStr) => {
    if (!dateStr) return undefined;
    const parsedDate = TimezoneUtils.parseFrenchDate(dateStr);
    return format(parsedDate, 'yyyy-MM-dd');
  });

/**
 * Validation de plage de dates
 */
export const dateRangeValidation = z.object({
  startDate: strictDateValidation,
  endDate: strictDateValidation
}).refine((data) => {
  const start = parseISO(data.startDate);
  const end = parseISO(data.endDate);
  return start <= end;
}, {
  message: "La date de fin doit être postérieure à la date de début",
  path: ["endDate"]
});

/**
 * Utilitaires de formatage pour l'affichage
 */
export const formatUtils = {
  /**
   * Formate un montant pour l'affichage français
   */
  formatAmount(amount: string | number): string {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(num);
  },

  /**
   * Formate une date pour l'affichage français
   */
  formatDate(date: string | Date, formatStr: string = 'dd/MM/yyyy'): string {
    return TimezoneUtils.formatFrench(date, formatStr);
  },

  /**
   * Formate une date avec l'heure
   */
  formatDateTime(date: string | Date): string {
    return TimezoneUtils.formatFrench(date, 'dd/MM/yyyy HH:mm');
  }
};