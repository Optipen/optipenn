CRM Devis & Relances

Prérequis
- Node 18+
- Base PostgreSQL (Neon/Render/Local). SQLite fallback non inclus ici.

Installation
1. Copier .env.example vers .env et définir les variables.
2. Installer dépendances:
   npm install
3. Pousser le schéma (Drizzle):
   npm run db:push
4. Seed (optionnel):
   npm run seed
5. Démarrer en dev:
   npm run dev

Variables d'environnement (.env)
- DATABASE_URL=postgres://user:pass@host/db
- JWT_SECRET=change-me
- SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM (optionnel)
- SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD (optionnel)

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

