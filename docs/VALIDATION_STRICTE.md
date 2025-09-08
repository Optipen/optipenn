# Validation Stricte des Formats - Documentation

Ce document décrit l'implémentation de la validation stricte des formats (emails, montants, dates) et la gestion cohérente des fuseaux horaires dans l'application Optipen.

## Vue d'ensemble

L'application dispose maintenant d'un système de validation renforcé qui:
- ✅ Valide strictement les formats d'emails avec vérification de domaine
- ✅ Supporte plusieurs formats de montants avec normalisation automatique
- ✅ Gère les dates avec prise en compte des fuseaux horaires
- ✅ Fournit des utilitaires de formatage pour l'affichage

## Validation des Emails

### `strictEmailValidation`

Validation renforcée qui vérifie:
- Format RFC-compliant
- Longueur de la partie locale (max 64 caractères)
- Longueur totale (max 254 caractères)
- Absence de points consécutifs
- Structure valide du domaine
- Blocage des domaines suspects

```typescript
import { strictEmailValidation } from '@shared/validation-utils';

// ✅ Emails valides
strictEmailValidation.parse('jean.dupont@entreprise.fr');
strictEmailValidation.parse('user+tag@company.org');

// ❌ Emails rejetés
strictEmailValidation.parse('user@example.com'); // Domaine bloqué
strictEmailValidation.parse('user..double@domain.com'); // Points consécutifs
```

## Validation des Montants

### `strictAmountValidation`

Supporte plusieurs formats et normalise automatiquement:

```typescript
import { strictAmountValidation } from '@shared/validation-utils';

// Formats supportés
strictAmountValidation.parse('1000');        // → '1000'
strictAmountValidation.parse('1000.50');     // → '1000.50'
strictAmountValidation.parse('1000,50');     // → '1000.50'
strictAmountValidation.parse('12 000.00');   // → '12000.00'
strictAmountValidation.parse('1,234.56');    // → '1234.56' (US)
strictAmountValidation.parse('1.234,56');    // → '1234.56' (Européen)
```

### Règles de validation
- Montants positifs uniquement
- Maximum 2 décimales
- Limite: 999 999 999.99 €
- Normalisation automatique vers format point décimal

## Validation des Dates

### Formats supportés
- ISO: `YYYY-MM-DD`
- Français: `DD/MM/YYYY`, `DD-MM-YYYY`, `DD.MM.YYYY`

### Types de validation disponibles

```typescript
import { 
  strictDateValidation,
  pastDateValidation,
  futureDateValidation,
  optionalStrictDateValidation 
} from '@shared/validation-utils';

// Date normale (normalise vers ISO)
strictDateValidation.parse('15/01/2024'); // → '2024-01-15'

// Date passée uniquement
pastDateValidation.parse('01/01/2024'); // ✅ Si dans le passé

// Date future uniquement
futureDateValidation.parse('31/12/2025'); // ✅ Si dans le futur

// Date optionnelle
optionalStrictDateValidation.parse(undefined); // → undefined
optionalStrictDateValidation.parse('15/01/2024'); // → '2024-01-15'
```

## Gestion des Fuseaux Horaires

### `TimezoneUtils`

Classe utilitaire pour la gestion cohérente des fuseaux horaires:

```typescript
import { TimezoneUtils } from '@shared/validation-utils';

// Fuseau par défaut: Europe/Paris
const DEFAULT_TIMEZONE = 'Europe/Paris';

// Parser une date française
const date = TimezoneUtils.parseFrenchDate('15/01/2024');

// Formater pour l'affichage
const formatted = TimezoneUtils.formatFrench(date, 'dd/MM/yyyy');

// Vérifications de dates
TimezoneUtils.isPastDate(date);   // Vérifie si dans le passé
TimezoneUtils.isFutureDate(date); // Vérifie si dans le futur

// Conversion de timezone
const parisTime = TimezoneUtils.toTimezone(new Date(), 'Europe/Paris');
const utcTime = TimezoneUtils.fromTimezone(parisTime, 'Europe/Paris');
```

## Utilitaires de Formatage

### `formatUtils`

```typescript
import { formatUtils } from '@shared/validation-utils';

// Formatage des montants (locale française)
formatUtils.formatAmount(1234.56); // → "1 234,56 €"

// Formatage des dates
formatUtils.formatDate('2024-01-15'); // → "15/01/2024"
formatUtils.formatDateTime(date); // → "15/01/2024 14:30"
```

## Intégration dans les Schémas

Les schémas Zod existants ont été mis à jour pour utiliser les nouvelles validations:

```typescript
// shared/schema.ts

export const insertClientSchema = createInsertSchema(clients).extend({
  email: strictEmailValidation, // ← Validation email renforcée
  // ...
});

export const insertQuoteSchema = createInsertSchema(quotes).extend({
  amount: strictAmountValidation,    // ← Validation montant renforcée
  sentDate: pastDateValidation,      // ← Date passée obligatoire
  plannedFollowUpDate: optionalStrictDateValidation, // ← Date optionnelle
  // ...
});
```

## Exemples d'Usage

### Frontend - Validation de formulaire

```typescript
import { insertQuoteSchema } from '@shared/schema';

const formData = {
  reference: 'DEVIS-2024-001',
  clientId: 'client-123',
  description: 'Développement application',
  amount: '15 000,50', // Format français
  sentDate: '15/01/2024', // Format français
};

try {
  const validatedData = insertQuoteSchema.parse(formData);
  // validatedData.amount → '15000.50'
  // validatedData.sentDate → '2024-01-15'
} catch (error) {
  // Gestion des erreurs de validation
}
```

### Backend - Formatage pour affichage

```typescript
import { formatUtils } from '@shared/validation-utils';

// Formatter les données pour l'API
const quote = await getQuote(id);
const response = {
  ...quote,
  amountFormatted: formatUtils.formatAmount(quote.amount),
  sentDateFormatted: formatUtils.formatDate(quote.sentDate),
};
```

## Tests

Le système de validation est couvert par des tests complets:
- **35 tests** pour les utilitaires de validation
- **14 tests** pour l'intégration des schémas
- **Tous les tests existants** continuent de passer

```bash
# Exécuter les tests de validation
npm test shared/__tests__/validation-utils.test.ts
npm test shared/__tests__/schema-validation.test.ts
```

## Migration

### Données existantes
Les données existantes restent compatibles. La validation stricte s'applique uniquement aux nouvelles données.

### Frontend
Les formulaires existants bénéficient automatiquement des nouvelles validations. Aucune modification requise pour la compatibilité de base.

### Recommandations
1. Tester les formulaires avec différents formats d'entrée
2. Mettre à jour les messages d'erreur si nécessaire
3. Utiliser `formatUtils` pour l'affichage cohérent des données

## Sécurité

### Améliorations apportées
- **Email**: Blocage des domaines temporaires/suspects
- **Montants**: Validation stricte des formats numériques
- **Dates**: Prévention des dates invalides/malformées
- **Timezone**: Gestion cohérente pour éviter les bugs de fuseau

### Domaines bloqués
- `example.com`, `test.com`, `localhost`
- Services d'email temporaire: `10minutemail.com`, `tempmail.org`, etc.

---

Pour plus d'exemples, voir `shared/validation-examples.ts`.