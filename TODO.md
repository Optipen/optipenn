### Correctifs critiques (backend)

- **Suppression en cascade clients/devis/relances**
  - Prompts:
    - Les `follow_ups` sont-ils supprimés pour tous les devis du client via `quoteId IN (devis du client)` ?
    - La suppression est-elle transactionnelle et ordonnée (relances → devis → client) ?
    - Le fallback mémoire et la voie SQL ont-ils un comportement aligné ?
  - Critères d’acceptation:
    - Supprimer un client ne laisse aucune relance orpheline ni devis résiduel.
    - Tests API confirment le comportement en mémoire et en SQL.

### Sécurité Auth/JWT

- **Durcir le cookie JWT**
  - Prompts:
    - En prod: `secure: true`, `httpOnly: true`, `sameSite` adéquat (lax/strict), `path=/`, `domain` si multi-sous-domaines.
    - Expiration cohérente (7j) et synchronisation TZ.
    - En dev: options clairement relâchées et documentées.
  - Critères:
    - Cookie non accessible JS, marqué sécurisé en prod.

- **Forcer `JWT_SECRET` en prod**
  - Prompts:
    - Démarrage échoue clairement si secret manquant ?
    - Procédure de rotation et invalidation documentée ?
  - Critères:
    - Lancement sans secret → erreur; avec secret → OK.

- **Anti brute-force login**
  - Prompts:
    - Rate limit `/api/auth/login` (IP/fenêtre). Temps de réponse constant.
  - Critères:
    - 429 après X tentatives; logs d’alerte.

### Permissions et exposition des routes

- **Audit des routes protégées**
  - Prompts:
    - Chaque route sensible utilise `requireAuth` avec rôles exacts ?
    - Cas 401/403 uniformes (message FR, code correct) ?
  - Critères:
    - Tests 401/403 pour chaque endpoint.

### CORS/CSRF

- **Stratégie si front ≠ même origine**
  - Prompts:
    - Définir origines autorisées CORS et cookies `credentials`.
    - Mettre en place CSRF (double-submit token ou header custom) pour mutations.
  - Critères:
    - Mutations refusées sans CSRF si activé; acceptées avec.

### Emails/cron (relances automatiques)

- **Fiabiliser envoi SMTP**
  - Prompts:
    - Timezone cron, logs succès/échec, retry/backoff.
    - Mode dry-run en dev; validation SMTP au boot (host/port/user/pass/from).
    - Templates (i18n, signature), opt-out/rate limit par client/jour.
  - Critères:
    - Journal détaillé; pas d’avalanche d’emails; erreurs SMTP gérées.

### Exports (CSV/PDF)

- **CSV robuste**
  - Prompts:
    - Échapper quotes, virgules, retours ligne (RFC 4180). Ajouter BOM UTF‑8 pour Excel au besoin.
    - Streaming si dataset volumineux.
  - Critères:
    - Ouverture Excel/Sheets sans corruption; tests avec champs contenant `",;\n`.

- **PDF réaliste**
  - Prompts:
    - Confirmer stratégie: HTML simple (assumé) ou génération PDF (lib/service).
    - Si placeholder: message explicite en UI et doc; sinon implémenter.
  - Critères:
    - Sortie conforme à la décision; bouton UI aligné.

### Modèle & statistiques

- **Temps moyen de réponse**
  - Prompts:
    - Ajouter champ « date d’acceptation » dans `quotes` si manquant (migration).
    - Recalculer métrique avec ce champ (pas « aujourd’hui »).
  - Critères:
    - Valeur fiable dès qu’il existe des devis acceptés.

- **CA mensuel et formatage**
  - Prompts:
    - Vérifier l’échelle « k€ » vs montants; libeller l’axe clairement.
  - Critères:
    - Lecture intuitive par l’utilisateur.

### Suivi de relance planifiée

- **Parcours planification**
  - Prompts:
    - UI pour définir/modifier `plannedFollowUpDate` (création/édition devis).
    - Endpoint pour mise à jour; invalidations de cache sur succès.
    - UX « en retard / aujourd’hui » cohérente (dashboard + liste).
  - Critères:
    - Marquage clair; tests UI et API.

### Frontend Auth/UX

- **Gestion globale des 401**
  - Prompts:
    - Centraliser handling 401 (rediriger `/login`, éviter crash Query).
    - Page login: messages d’erreurs explicites; état chargement.
  - Critères:
    - 401 entraîne redirection propre et UX stable.

- **Modals d’édition**
  - Prompts:
    - Ajouter/compléter modals « Éditer client » et « Éditer devis ».
  - Critères:
    - CRUD complet côté UI.

### Accessibilité et i18n

- **A11y de base**
  - Prompts:
    - Labels, ARIA roles, contraste, tab order, focus states visibles.
  - Critères:
    - Audit DevTools A11y passe sans erreurs majeures.

- **i18n FR uniforme**
  - Prompts:
    - Chaînes en FR, formats date/€ locaux, cohérence des messages.
  - Critères:
    - Aucune chaîne anglaise résiduelle.

### Performance

- **Backend**
  - Prompts:
    - Éviter N+1 (pré-charger clients pour devis). Pagination/tri/filtre côté DB.
  - Critères:
    - Temps de réponse stables aux volumes moyens.

- **Frontend**
  - Prompts:
    - Virtualisation longues tables; mémoïsation; loaders cohérents.
  - Critères:
    - Scroll fluide; re-render limités.

### Observabilité et robustesse

- **Logs/Health/Metrics**
  - Prompts:
    - Logs JSON structurés; endpoint `/api/health` (DB/SMTP), métriques latence/taux erreurs.
  - Critères:
    - Logs exploitables; healthcheck pour l’orchestrateur.

- **Gestion d’erreurs UI**
  - Prompts:
    - Error boundary global; toasts/messagerie d’erreurs cohérentes.
  - Critères:
    - Erreurs réseau/serveur affichées proprement.

### Tests

- **Unitaires/Intégration/E2E**
  - Prompts:
    - API: auth, clients, quotes, follow-ups, stats, exports.
    - E2E: login → ajouter client/devis → planifier/relancer → vérifier stats.
    - Mocks SMTP; seed de données de test.
  - Critères:
    - Couverture utile; pipeline CI verte.

### Déploiement/Config prod

- **Variables d’environnement**
  - Prompts:
    - Maintenir `.env.example` complet (`PORT`, `DATABASE_URL`, `JWT_SECRET`, `SMTP_*`).
    - Validation au démarrage avec erreurs claires si manquantes.
  - Critères:
    - Démarrage impossible si variables critiques absentes.

- **Base de données**
  - Prompts:
    - Automatiser `drizzle-kit push`; migrations vérifiables; seed reproductible.
  - Critères:
    - Provisionnement sans intervention fragile.

- **Conteneurisation (optionnel)**
  - Prompts:
    - Dockerfile multi-stage; healthcheck; port unique; variables en runtime.
  - Critères:
    - Image reproductible; boot fiable.

### Hygiène des dépendances

- **Nettoyer deps non utilisées**
  - Prompts:
    - Vérifier `passport`, `express-session`, `connect-pg-simple`, `memorystore`, `ws`.
  - Critères:
    - `npm ls` propre; surface d’attaque réduite.

### Données et conformité

- **Validation et intégrité**
  - Prompts:
    - Unicité (emails, références), formats montants, gestion fuseaux sur dates.
  - Critères:
    - Cas limites traités (virgule décimale, TZ différentes).

- **Confidentialité (RGPD)**
  - Prompts:
    - Procédure d’export/suppression des données et mentions légales.
  - Critères:
    - Processus documenté et testable.

---

Checklist de démarrage rapide (ordre conseillé):

1) Corriger suppression en cascade SQL + tests
2) Durcir cookie JWT + forcer `JWT_SECRET`
3) CSV conforme RFC 4180 (+ BOM Excel si besoin)
4) Métriques: date d’acceptation + temps de réponse réel
5) UI planification relance + endpoints associés
6) Tests API/E2E de base + seed
7) Logs/healthcheck + doc `.env.example`
8) Nettoyage deps inutilisées


