# Le Budget Backend

NestJS + Fastify API powering the *Le Budget* personal finance app. Built with Prisma and PostgreSQL, it exposes REST endpoints, server-sent events, and auto-generated OpenAPI docs.

## Stack

- **Runtime**: Node.js, NestJS (Fastify adapter)
- **Persistence**: PostgreSQL (via Prisma ORM)
- **Realtime**: Server-Sent Events (`/events`)
- **API Docs**: Swagger UI (`/docs`) & JSON (`/docs-json`)

## Architecture Overview

```
backend/
├── src/
│   ├── app.module.ts             # Root module wiring config + feature modules
│   ├── main.ts                   # Fastify bootstrap, global pipes, filters, Swagger
│   ├── common/                   # Shared services, DTOs, filters (Prisma error handler)
│   ├── config/                   # Configuration loader + Joi validation
│   ├── prisma/                   # PrismaService (global DB access)
│   └── modules/
│       ├── accounts/             # Accounts CRUD, balance tracking
│       ├── transactions/         # Transactions with pagination/search & running balance
│       ├── categories/           # User-defined categories (income/expense/etc.)
│       ├── budget/               # Budget months, groups, categories, totals
│       ├── events/               # SSE emitter + controller
│       └── health/               # `/health` endpoint
├── prisma/
│   ├── schema.prisma             # Data model (users, accounts, transactions, budget)
│   └── seed.ts                   # Demo data aligned with frontend fixtures
├── docker-compose.dev.yml        # PostgreSQL dev container
├── .env.example                  # Environment template
├── package.json                  # Scripts, dependencies
├── tsconfig*.json                # Typescript configs
└── README.md                     # This file
```

## Domain Model

Prisma schema models the core budgeting entities:

- `User` – root owner, seeded with demo credentials
- `Account` – supports multiple types, tracks initial/current balances
- `Transaction` – signed amounts with optional category, memo, running balance calculations
- `Category` – scoped per user, typed (`EXPENSE`, `INCOME`, …)
- `BudgetMonth` – monthly snapshot with carry-over and income
- `BudgetCategoryGroup` / `BudgetCategory` – represent grouped “envelope” budgeting totals

## REST Endpoints (high-level)

| Resource | Methods |
| --- | --- |
| `/health` | `GET` – status check |
| `/events` | `GET` (SSE) – realtime notifications |
| `/accounts` | `GET`, `POST` |
| `/accounts/:id` | `GET`, `PATCH`, `DELETE` (archives) |
| `/accounts/:accountId/transactions` | `GET` (paginate/filter), `POST` |
| `/accounts/:accountId/transactions/:transactionId` | `GET`, `PATCH`, `DELETE` |
| `/categories` | `GET`, `POST` |
| `/categories/:id` | `GET`, `PATCH`, `DELETE` |
| `/budget/months` | `GET`, `POST` |
| `/budget/months/:monthKey` | `GET` (by ID or `YYYY-MM` string) |
| `/budget/months/:id` | `PATCH` |
| `/budget/months/:monthId/groups` | `POST` |
| `/budget/groups/:groupId` | `PATCH`, `DELETE` |
| `/budget/groups/:groupId/categories` | `POST` |
| `/budget/categories/:categoryId` | `PATCH`, `DELETE` |

Automatic OpenAPI definitions are available at `/docs`.

## Realtime Events

`EventsService` pushes structured events (e.g., `account.created`, `transaction.updated`) onto an SSE stream. Frontend consumers can subscribe via `EventSource('/events')` to stay in sync.

## Getting Started

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Start PostgreSQL**
   ```bash
   docker compose -f docker-compose.dev.yml up -d
   ```
3. **Run database migrations**
   ```bash
   npm run prisma:migrate:dev -- --name init
   ```
4. **Generate Prisma Client** (usually part of migration, safe to repeat)
   ```bash
   npm run prisma:generate
   ```
5. **Seed demo data**
   ```bash
   npm run prisma:seed
   ```
   Note the logged `DEFAULT_USER_ID` and place it in `.env`.
6. **Start the API (watch mode)**
   ```bash
   npm run start:dev
   ```
   Or build once and run:
   ```bash
   npm run build && npm start
   ```
7. **Explore the docs** – http://localhost:3000/docs

## Environment Variables

Copy `.env.example` to `.env` and adjust as needed:

- `NODE_ENV` – `development` | `production` | …
- `PORT` – HTTP port (default `3000`)
- `DATABASE_URL` – PostgreSQL connection string
- `DEFAULT_USER_ID` – optional shortcut; otherwise the first user is auto-selected

## Scripts

| Command | Description |
| --- | --- |
| `npm run start:dev` | Run NestJS with ts-node-dev |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Start compiled app |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate` | Apply migrations in production |
| `npm run prisma:migrate:dev` | Create/apply dev migration |
| `npm run prisma:seed` | Seed demo/user data |

## Notes & Next Steps

- **Auth**: Currently the `UserContextService` picks a default seeded user. Replace with proper authentication once ready.
- **Validation**: DTOs use `class-validator`; adjust as API contracts evolve.
- **Testing**: No automated tests yet—add unit/e2e specs before production.
- **CI/CD**: Integrate migration + seed steps into your deployment pipeline.

Enjoy budgeting! 🎯
