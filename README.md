CRM Devis & Relances

**Système de gestion de devis et relances clients moderne et sécurisé.**

## 🚀 Prérequis
- Node 18+
- Base PostgreSQL (Neon/Render/Local). SQLite fallback non inclus.

## 📦 Installation Rapide
1. **Configurer l'environnement :**
   ```bash
   cp .env.example .env
   # Éditer .env avec vos valeurs
   ```
2. **Installer les dépendances :**
   ```bash
   npm install
   ```
3. **Configurer la base de données :**
   ```bash
   npm run db:push
   ```
4. **Peupler avec des données de test (optionnel) :**
   ```bash
   npm run seed
   ```
5. **Démarrer en développement :**
   ```bash
   npm run dev
   ```

## 🎭 Mode Démo

**Lancement ultra-rapide sans configuration !**

Le mode démo permet de tester l'application instantanément sans base de données, sans variables d'environnement, et sans configuration.

```bash
# Installation et démarrage en une commande
npm install && npm run demo
```

**Fonctionnalités du mode démo :**
- ✅ Aucune configuration requise (pas de .env, pas de DATABASE_URL)
- ✅ Données d'exemple automatiquement chargées en mémoire
- ✅ Auto-connexion en tant qu'admin (admin@example.com)
- ✅ Stockage temporaire en mémoire (SQLite/PostgreSQL non requis)
- ✅ Données cohérentes : clients, devis, suivis avec dates récentes
- ⚠️ **ATTENTION** : Toutes les données disparaissent au redémarrage

**Accès :**
- URL : `http://localhost:5000`
- Utilisateur automatique : Admin Demo (admin@example.com)
- Statut : `GET /api/status` affiche une bannière de mode démo

**Note importante :** Le mode démo est uniquement destiné à la démonstration. N'utilisez jamais `DEMO_MODE=1` en production.

---

## 📋 Variables d'Environnement

**⚠️ VALIDATION OBLIGATOIRE ⚠️**

L'application valide automatiquement toutes les variables d'environnement au démarrage. Les variables sensibles sont obligatoires et doivent respecter des critères de sécurité.

Consultez [`.env.example`](./.env.example) pour la liste complète et la documentation de chaque variable.

**Variables critiques :**
- `DATABASE_URL` - Connexion PostgreSQL
- `JWT_SECRET` - Clé de chiffrement (32+ caractères en production)

## 📁 Structure du Projet

```
optipenn/
├── client/           # Interface React (TypeScript)
├── server/           # API Express (TypeScript)  
├── shared/           # Schémas et validations partagés
├── docs/             # Documentation technique
└── package.json      # Configuration npm
```

## 📚 Documentation

La documentation complète se trouve dans le dossier [`docs/`](./docs/) :

- [**Analyse de Qualité**](./docs/CODE_QUALITY_ANALYSIS.md) - Évaluation du code et recommandations
- [**Sécurité**](./docs/SECURITY.md) - Guide sécurité et bonnes pratiques
- [**Performance**](./docs/PERFORMANCE_IMPROVEMENTS.md) - Optimisations implémentées
- [**Plus de docs...**](./docs/README.md) - Index complet de la documentation

**Configuration:**
1. Copiez .env.example vers .env
2. Remplissez les variables obligatoires
3. L'application vérifiera la configuration au démarrage

Voir [ENV_VALIDATION.md](ENV_VALIDATION.md) pour la documentation complète.

Scripts
- npm run dev: démarre API + Vite en mode dev
- npm run build: build client + bundle serveur
- npm run start: lance en production
- npm run db:push: applique le schéma Drizzle
- npm run seed: insère des données d'exemple

Fonctionnalités
- Auth JWT via cookies (admin/manager/sales)
- Gestion Clients, Devis, Relances
- Dashboard avec KPIs et relances en attente
- Export CSV, relances auto quotidiennes par email

Tests basiques
- Vérifier login via /login (admin@example.com / Admin1234 si seed)
- Vérifier création client/devis et relance manuelle

Déploiement
- Docker/Heroku/Render: définir PORT et DATABASE_URL. Construire puis npm start.

