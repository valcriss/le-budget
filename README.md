# Le Budget

Application de gestion budgétaire personnelle articulée autour d'une API NestJS et d'un frontend Angular. Le projet fournit une expérience complète : gestion des comptes, opérations, catégories et budgets, avec synchronisation temps réel (SSE) et déploiement automatisé via Docker et GitHub Actions.

## Pile technologique

- **Backend** : Node.js 24, NestJS (adaptateur Fastify), Prisma, PostgreSQL, JWT
- **Frontend** : Angular 20, Tailwind CSS, Jest pour les tests unitaires
- **Infrastructure** : Docker (multi-stage builds, entrypoints dédiés), GitHub Container Registry, GitHub Actions
- **Dev tools** : ESLint, Prettier, TypeScript, Docker Compose

## Structure du dépôt

```
.
├── backend/                  # API NestJS (Prisma, services métier, tests)
├── frontend/                 # SPA Angular (standalone components, stores, UI)
├── docker/                   # Scripts et templates Docker (frontend/backend)
├── Dockerfile.backend        # Build image API (migration Prisma au démarrage)
├── Dockerfile.frontend       # Build image frontend (Nginx + config runtime)
├── docker-compose.yml        # Orchestration backend+frontend+PostgreSQL
├── .github/workflows/        # Workflows CI (lint, tests, build, publication)
└── .env.example              # Variables d'environnement à adapter
```

## Pré-requis

- Node.js 24 (géré via Volta si souhaité)
- npm 10+
- Docker Engine et Docker Compose v2
- Accès à un registre de conteneurs (GHCR par défaut)
- PostgreSQL local ou conteneur (si exécution hors Docker Compose)

## Variables d'environnement

Copiez `.env.example` en `.env` et ajustez les valeurs selon votre contexte.

| Variable | Description | Valeur par défaut |
| --- | --- | --- |
| `NODE_ENV` | Mode d'exécution du backend | `production` |
| `PORT` | Port exposé par l'API | `3000` |
| `FRONTEND_PORT` | Port HTTP exposé par le frontend | `8080` |
| `DATABASE_URL` | Chaîne de connexion PostgreSQL (utilisée par Prisma) | `postgresql://postgres:postgres@db:5432/le-budget?schema=public` |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Identifiants PostgreSQL injectés dans le conteneur `db` | `postgres` / `postgres` / `le-budget` |
| `JWT_SECRET` | Secret de signature des tokens JWT | `change-me` |
| `JWT_EXPIRES_IN` | Durée de vie des tokens d'accès | `1h` |
| `JWT_REFRESH_EXPIRES_IN` | Durée de vie des tokens de rafraîchissement | `30d` |
| `FRONTEND_API_BASE_URL` | URL du backend injectée dans le frontend au runtime | `http://backend:3000` |
| `REGISTRY`, `REGISTRY_NAMESPACE`, `IMAGE_TAG` | Paramètres utilisés par `docker-compose.yml` pour pointer vers vos images | `ghcr.io`, `valcriss`, `latest` |

## Installation locale (sans Docker)

### 1. Backend

```bash
cd backend
npm ci
cp .env.example .env          # ou configurez vos variables
npm run prisma:migrate:dev    # applique/ crée les migrations
npm run prisma:seed           # jeu de données de démonstration (optionnel)
npm run start:dev             # serveur sur http://localhost:3000
```

Accédez à la documentation Swagger via http://localhost:3000/docs.

### 2. Frontend

```bash
cd frontend
npm ci
npm start                     # http://localhost:4200
```

Par défaut, le frontend communique avec http://localhost:3000. Modifiez `frontend/public/config.js` pour cibler un autre backend en mode développement.

## Exécution via Docker Compose

1. Renseignez vos variables dans `.env` (notamment `REGISTRY_NAMESPACE` si vous poussez vos propres images).
2. Construisez et poussez les images si nécessaire :
   ```bash
   docker build -f Dockerfile.backend -t ghcr.io/<owner>/le-budget-backend:latest .
   docker build -f Dockerfile.frontend -t ghcr.io/<owner>/le-budget-frontend:latest .
   docker push ghcr.io/<owner>/le-budget-backend:latest
   docker push ghcr.io/<owner>/le-budget-frontend:latest
   ```
3. Lancez l'environnement :
   ```bash
   docker compose up -d
   ```

Services exposés :

- Backend : http://localhost:${PORT:-3000}
- Frontend : http://localhost:${FRONTEND_PORT:-8080}
- PostgreSQL : port interne 5432 (volume `postgres-data`)

Le conteneur backend exécute `npx prisma migrate deploy` avant de démarrer le serveur afin de garantir que le schéma est à jour. Le conteneur frontend génère dynamiquement `config.js` à partir de la variable `API_BASE_URL`, ce qui permet d'adapter l'URL de l'API au runtime.

## Intégration continue & publication Docker

Le workflow `.github/workflows/publish.yml` se déclenche sur chaque tag poussé :

1. Build + lint + tests du backend et du frontend.
2. Construction et publication de deux images Docker :
   - `ghcr.io/<owner>/le-budget-backend:<tag>` et `latest`
   - `ghcr.io/<owner>/le-budget-frontend:<tag>` et `latest`

Assurez-vous que GitHub Container Registry est activé sur votre organisation/utilisateur et que le PAT ou `GITHUB_TOKEN` possède les droits `packages:write`.

## Commandes utiles

### Backend

| Commande | Description |
| --- | --- |
| `npm run start:dev` | Dev server rechargé à chaud |
| `npm run build` / `npm start` | Build TypeScript puis lance en mode production |
| `npm run prisma:migrate` | Applique les migrations en production |
| `npm run prisma:seed` | Insère les données de démonstration |
| `npm test` | Suite de tests (c8 + ts-node) |

### Frontend

| Commande | Description |
| --- | --- |
| `npm start` | Serveur de dev (Angular CLI) |
| `npm run build` | Build production optimisé dans `dist/` |
| `npm test` | Tests Jest avec couverture |
| `npm run lint` | Vérification ESLint |

## Bonnes pratiques

- Toujours générer/mettre à jour la base Prisma (`npm run prisma:generate`) après une modification de schéma.
- Utiliser `FRONTEND_API_BASE_URL` pour aligner le frontend sur l'environnement cible (staging, prod...).
- Intégrer les migrations Prisma dans vos pipelines de déploiement pour éviter les divergences de schéma.
- Mettre à jour les secrets du dépôt GitHub (ex. `JWT_SECRET`, `DATABASE_URL`) avant de déclencher des builds taggés.

## Contribution

1. Créez une branche dérivée (`feature/...` ou `fix/...`).
2. Installez les dépendances et assurez-vous que lint/tests passent sur backend et frontend.
3. Documentez vos changements (README, commentaires ciblés).
4. Ouvrez une Pull Request en décrivant l'impact fonctionnel et technique.

Bonne gestion de budget ! 💶
