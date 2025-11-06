# agents.md

Ce document synthétise les informations essentielles du projet **Le Budget** pour les agents et outils d'automatisation.

## Vue d’ensemble

- **Type d’application** : gestion budgétaire personnelle (comptes, transactions, catégories, budgets).
- **Architecture** : API **NestJS** + SPA **Angular**, synchronisation temps réel via SSE, déploiement conteneurisé (Docker / GitHub Actions).

## Pile technologique

| Couche      | Technologies clés |
|-------------|-------------------|
| Backend     | Node.js 24, NestJS (Fastify), Prisma, PostgreSQL, JWT |
| Frontend    | Angular 20 (standalone components), Tailwind CSS, Jest |
| Infrastructure | Docker / Docker Compose, GitHub Container Registry, GitHub Actions |
| Outils dev  | TypeScript, ESLint, Prettier, Volta (optionnel) |

## Structure du dépôt

```
.
├── backend/                  # API NestJS + Prisma
├── frontend/                 # SPA Angular + stores/têtes UI
├── docker/                   # Scripts et templates Docker
├── Dockerfile.backend        # Build image backend
├── Dockerfile.frontend       # Build image frontend
├── docker-compose.yml        # Orchestration backend + frontend + PostgreSQL
└── README.md                 # Documentation détaillée (installation, commandes…)
```

## Variables d’environnement (extraits)

- `DATABASE_URL` : chaîne de connexion PostgreSQL (utilisée par Prisma).
- `FRONTEND_API_BASE_URL` : URL du backend injectée dans le frontend.
- `JWT_SECRET` / `JWT_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN`.
- `REGISTRY`, `REGISTRY_NAMESPACE`, `IMAGE_TAG` : publication des images Docker.

Un fichier `.env.example` est fourni à la racine avec la liste complète.

## Installation locale

### Backend
```bash
cd backend
npm ci
cp .env.example .env            # ajuster si nécessaire
npm run prisma:migrate:dev      # migrations locales
npm run prisma:seed             # données de démonstration (optionnel)
npm run start:dev               # http://localhost:3000 (Swagger sur /docs)
```

### Frontend
```bash
cd frontend
npm ci
npm start                       # http://localhost:4200
```

### Docker Compose
1. Configurer `.env`.
2. Construire/publier les images si besoin.
3. Lancer `docker compose up -d`.

Services exposés :
- Backend : `http://localhost:${PORT:-3000}`
- Frontend : `http://localhost:${FRONTEND_PORT:-8080}`
- PostgreSQL : port interne `5432` (volume `postgres-data`)

## Commandes utiles

### Backend (`backend/`)
| Commande | Description |
|----------|-------------|
| `npm run start:dev`      | Serveur de développement |
| `npm run build`          | Compilation TypeScript |
| `npm run prisma:migrate` | Migrations en production |
| `npm run prisma:seed`    | Jeu de données exemple |
| `npm test`               | Tests unitaires |
| `npm run lint`           | ESLint |

### Frontend (`frontend/`)
| Commande | Description |
|----------|-------------|
| `npm start`             | Serveur Angular CLI |
| `npm run build`         | Build production (`dist/`) |
| `npm test`              | Tests Jest (coverage) |
| `npm run lint`          | ESLint |

## Qualité & validations obligatoires

Pour **toute validation de développement côté backend ou frontend**, exécuter systématiquement :

1. **Lint** : `npm run lint`
2. **Tests** : `npm test`
3. **Build** : `npm run build`

Ces trois commandes doivent passer dans les dossiers concernés (`backend/` et/ou `frontend/`) avant toute intégration.

## Bonnes pratiques

- Lancer `npx prisma migrate deploy` ou l’équivalent avant de démarrer le backend en production.
- Garder `FRONTEND_API_BASE_URL` aligné avec l’environnement ciblé (dev/staging/prod).
- Documenter les changements majeurs via le `README.md` ou des fichiers dédiés.
- Reposer les migrations/seed Prisma dès que le schéma évolue.

## Pipelines CI/CD

- Voir `.github/workflows/` : build + lint + tests + publication d’images Docker (`backend` & `frontend`) sur GitHub Container Registry à chaque tag.
- Les workflows supposent des secrets configurés (`REGISTRY`, `DATABASE_URL`, `JWT_SECRET`, etc.).

## Ressources complémentaires

- `README.md` : guide exhaustif (installation, commandes, bonnes pratiques).
- `docker/` : scripts d’entrée pour générer la configuration runtime des conteneurs.
- Swagger du backend : `http://localhost:3000/docs` (via `start:dev`).

Ce fichier peut être adapté selon l’évolution de l’architecture ou des conventions du projet.
