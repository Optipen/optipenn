# Validation des Variables d'Environnement

Ce système assure la validation obligatoire des variables d'environnement sensibles au démarrage de l'application.

## Fonctionnalités

### Variables Validées

#### Variables Sensibles (valeurs masquées dans les logs)
- **`DATABASE_URL`** *(obligatoire)* - URL de connexion à la base de données
  - Format: `postgres://user:pass@host/db`
  - Validation: doit contenir `://` et faire plus de 10 caractères

- **`JWT_SECRET`** *(obligatoire)* - Secret pour signer les tokens JWT
  - Production: minimum 32 caractères, ne doit pas être `dev-secret-change`
  - Développement: minimum 8 caractères

- **`SMTP_HOST`** *(optionnel, obligatoire en production)* - Serveur SMTP
  - Format: nom d'hôte valide (alphanumeric, points, tirets)

- **`SMTP_USER`** *(optionnel, obligatoire en production)* - Utilisateur SMTP
  - Validation: chaîne non vide

- **`SMTP_PASS`** *(optionnel, obligatoire en production)* - Mot de passe SMTP
  - Validation: chaîne non vide

- **`CORS_ORIGIN`** *(optionnel)* - Origines autorisées pour CORS
  - Format: URLs ou domaines séparés par des virgules
  - Exemple: `https://example.com,http://localhost:3000`

- **`COOKIE_DOMAIN`** *(optionnel)* - Domaine pour les cookies
  - Format: nom de domaine valide

#### Variables Système
- **`NODE_ENV`** *(avec défaut)* - Mode d'environnement
  - Valeurs: `development`, `production`, `test`
  - Défaut: `development`

- **`PORT`** *(avec défaut)* - Port d'écoute du serveur
  - Format: nombre entre 1 et 65535
  - Défaut: `5000`

### Validation Groupée

Les variables SMTP doivent être présentes ensemble ou absentes ensemble. Une configuration partielle génère une erreur.

### Modes de Validation

#### Mode Développement (`development`)
- Exigences minimales pour JWT_SECRET
- Variables SMTP optionnelles

#### Mode Production (`production`)
- Exigences strictes pour JWT_SECRET (32+ caractères)
- Variables SMTP obligatoires
- Avertissement si SMTP manquant

#### Mode Test (`test`)
- Similaire au développement
- Utilisé pour les tests automatisés

## Utilisation

### Démarrage Automatique

La validation s'exécute automatiquement au démarrage du serveur:

```bash
npm run dev    # ou npm start
```

**Succès:**
```
[ENV-VALIDATION] Validation des variables d'environnement en mode: development
[ENV-VALIDATION] ✓ DATABASE_URL: [MASQUÉ] (URL de connexion à la base de données)
[ENV-VALIDATION] ✓ JWT_SECRET: [MASQUÉ] (Secret pour signer les tokens JWT)
✓ Variables d'environnement validées avec succès
```

**Échec:**
```
❌ Échec de la validation des variables d'environnement

Erreurs:
  - Variable obligatoire manquante: DATABASE_URL - URL de connexion à la base de données
  - Variable obligatoire manquante: JWT_SECRET - Secret pour signer les tokens JWT

L'application ne peut pas démarrer avec une configuration invalide.
```

### Validation Programmatique

```typescript
import { 
  validateEnvironmentVariables, 
  validateEnvironmentVariablesOrThrow,
  validateSingleEnvironmentVariable 
} from './server/env-validation';

// Validation complète avec rapport détaillé
const result = validateEnvironmentVariables();
if (!result.valid) {
  console.error('Erreurs:', result.errors);
}

// Validation avec exception en cas d'échec
try {
  validateEnvironmentVariablesOrThrow();
  console.log('Configuration valide');
} catch (error) {
  console.error('Configuration invalide:', error.message);
}

// Validation d'une variable spécifique
const jwtValidation = validateSingleEnvironmentVariable('JWT_SECRET');
if (!jwtValidation.valid) {
  console.error(jwtValidation.error);
}
```

## Configuration Recommandée

### Développement (.env.local)
```bash
DATABASE_URL=postgres://user:pass@localhost/devdb
JWT_SECRET=development-secret-key-123456789
NODE_ENV=development
PORT=3000
```

### Production
```bash
DATABASE_URL=postgres://user:strongpass@prod-host/proddb
JWT_SECRET=very-secure-production-jwt-secret-with-32-plus-characters
NODE_ENV=production
SMTP_HOST=smtp.mailprovider.com
SMTP_USER=your-email@domain.com
SMTP_PASS=your-smtp-password
CORS_ORIGIN=https://yourdomain.com
COOKIE_DOMAIN=yourdomain.com
PORT=5000
```

## Sécurité

- **Valeurs masquées**: Les variables sensibles ne sont jamais affichées en clair dans les logs
- **Validation stricte**: Mode production exige des secrets robustes
- **Échec rapide**: L'application refuse de démarrer avec une configuration invalide
- **Audit complet**: Logs détaillés de toutes les variables validées

## Tests

Le système inclut une suite de tests complète:

```bash
npm test -- server/__tests__/env-validation.test.ts
```

Tests couverts:
- Validation des variables obligatoires
- Validation spécifique par mode (dev/prod/test)
- Validation des formats (URL, domaines, ports)
- Validation groupée (SMTP)
- Gestion des valeurs par défaut
- Masquage des valeurs sensibles