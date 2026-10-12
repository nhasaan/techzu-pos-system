# Techzu POS System

A multi-outlet F&B point-of-sale system:

1. A single company runs several outlets.
2. HQ manages the master menu and assigns items to outlets, optionally overriding prices.
3. Outlets track their own stock and make sales.
4. HQ sees revenue and top-selling items across outlets.

| | |
|---|---|
| **Stack** | Node.js 24 LTS · Express 5 · PostgreSQL · Redis (optional) · React 19 + Vite 8 · Tailwind CSS 4 · TypeScript 6 · Zod 4 · Drizzle ORM |
| **Backend** | Layered: routes → controllers → services → repositories, with zod validation and a central error middleware |
| **Ops** | Dockerfiles, docker compose, GitHub Actions CI, Render blueprint |

## Contents

- [Quick start (Docker)](#quick-start-docker)
- [Local development](#local-development)
- [Demo users](#demo-users)
- [API endpoints](#api-endpoints)
- [Schema](#schema)
- [Architecture](#architecture)
- [Scaling strategy](#scaling-strategy)
- [Project structure](#project-structure)
- [Further documentation](#further-documentation)

## Quick start (Docker)

You need Docker with Compose v2. The app containers join the external **`common-net`** network and use the shared Postgres and Redis there, reachable as `postgres` and `redis`.

```bash
# 1. Configuration (once): point DATABASE_URL / REDIS_URL at the shared containers, set JWT_SECRET
cp orchestrate/backend/.envs/app.env.example orchestrate/backend/.envs/app.env

# 2. Run: migrations run first, then the API and the web app
docker compose -f orchestrate/compose.yml up --build -d
docker compose -f orchestrate/compose.yml --profile db-job run --rm seed   # demo data (optional)
```

The `common-net` network with the shared `postgres` and `redis` containers must already exist (`docker network create common-net` once).

| What    | URL                         |
|---------|-----------------------------|
| Web app | http://localhost:8080       |
| API     | http://localhost:3000/api   |
| API docs (Swagger) | http://localhost:3000/docs |
| Health  | http://localhost:3000/health/ready |

### Versions

Everything runs on the latest stable releases:
- **Node.js:** 24 "Krypton", the active LTS. Node 26 becomes LTS on 2026-10-28; moving to it is a one-line change in `.nvmrc`, `engines` and the Docker images.
- **TypeScript:** 6.0. TypeScript 7 exists, but `typescript-eslint` doesn't support it yet.
- **`@types/node`:** follows the Node LTS runtime (24.x).

`npm audit` reports 0 vulnerabilities in both apps. Packages allowed to run install scripts are reviewed in each `package.json` under `allowScripts`.

## Local development

You need Node.js 24 LTS (see `.nvmrc`), PostgreSQL 14 or later (tested on 17 and 18), and optionally Redis 6+ or Valkey 8.

```bash
# 1. Backend
cd source/backend
cp .env.example .env            # set DATABASE_URL (and REDIS_URL if you run Redis)
npm install
npm run db:setup                # apply migrations + seed demo data
npm run dev                     # http://localhost:3000, Swagger at /docs

# 2. Frontend (another terminal)
cd source/frontend
cp .env.example .env            # VITE_API_BASE_URL=http://localhost:3000
npm install
npm run dev                     # http://localhost:5173
```

If you only need the databases:

```bash
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=pos_db postgres:17-alpine
docker run -d -p 6379:6379 redis:7-alpine
```

### Backend scripts

| Command | Description |
|---|---|
| `npm run dev` | Start with hot reload (tsx) |
| `npm run build` / `npm start` | Compile to `dist/` / run compiled |
| `npm run lint` / `npm run typecheck` | ESLint / `tsc --noEmit` |
| `npm test` | Unit and integration tests. Integration tests need `DATABASE_URL` pointing to a database whose name contains `test` |
| `npm run db:generate` | Generate a SQL migration from `src/shared/db/schema.ts` |
| `npm run db:migrate` / `db:seed` / `db:setup` | Apply migrations / seed / both |

Run the tests against a throwaway database:

```bash
createdb pos_test
DATABASE_URL=postgres://postgres:postgres@localhost:5432/pos_test npm test
```

### Environment variables (backend)

Every variable is validated at startup (`src/shared/config`). See `source/backend/.env.example` for the full list.

| Variable | Default (dev) | Notes |
|---|---|---|
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/pos_db` | Required in production |
| `REDIS_URL` | `redis://localhost:6379` | Optional; the API degrades gracefully without it |
| `JWT_SECRET` | dev-only value | **Required in production, at least 32 characters** (or set `JWT_PRIVATE_KEY_PATH` and `JWT_PUBLIC_KEY_PATH` for RS256) |
| `JWT_ACCESS_TOKEN_EXPIRY` / `JWT_REFRESH_TOKEN_EXPIRY` | `15m` / `7d` | |
| `CORS_ORIGINS` | empty (any origin) | Comma-separated allowlist |
| `TRUST_PROXY` | `0` | Number of proxy hops; set to `1` behind a load balancer |
| `RATE_LIMIT_MAX` / `LOGIN_RATE_LIMIT_MAX` | `300` / `10` per minute per IP | |
| `DB_POOL_MAX` / `DB_STATEMENT_TIMEOUT_MS` / `DB_LOCK_TIMEOUT_MS` | `10` / `10000` / `5000` | A lock wait beyond `DB_LOCK_TIMEOUT_MS` returns 503 "busy, retry" |
| `API_DOCS` | on outside production | Swagger UI at `/docs` |

## Demo users

The seed creates these users. Their password is **not stored in the repo**; it comes from `SEED_PASSWORD`:
- **On Render:** it's generated at deploy time. Find it under **pos-backend → Environment → `SEED_PASSWORD`**, and share it with reviewers privately.
- **Locally:** set `SEED_PASSWORD` in `.env` (or `orchestrate/backend/.envs/app.env`). If you leave it empty, a random password is generated and printed once in the terminal when the users are first created.

Existing users keep their password: re-running the seed never changes it.

| Username | Role | Can do |
|---|---|---|
| `sarah.chen` | superadmin | Everything, including user management |
| `james.wilson` | hqadmin | Outlets, master menu, assignments and prices, all outlets' stock, sales and reports |
| `david.kim` | outletadmin (Main Outlet) | Own outlet's menu, stock, sales and reports |
| `emma.lee` | outletadmin (Downtown Outlet) | Same, for Downtown |

The seed also creates 2 outlets and 25 menu items. Downtown overrides some prices. There is starting stock, plus 63 historical sales spread over 30 days so the reports have data.

## API endpoints

| | |
|---|---|
| **Base URL** | `/api` |
| **Auth** | `Authorization: Bearer <accessToken>` |
| **Interactive docs** | `/docs` |

Every response uses one envelope:

```json
{ "status": "SUCCESS", "message": "OK", "data": { }, "errors": null }
{ "status": "FAIL", "message": "Validation failed", "data": null, "errors": { "items.0.quantity": "Quantity must be at least 1" } }
```

| Method | Path | Who | Description |
|---|---|---|---|
| POST | `/auth/login` | public | `{ username, password }` returns `{ accessToken, refreshToken }` |
| POST | `/auth/refresh` | public | `{ refreshToken }` returns a new pair. Each refresh token works once; a later reuse revokes all sessions |
| POST | `/auth/logout` | any | Revokes the current session |
| GET | `/outlets` | HQ, superadmin | List outlets (paginated) |
| POST | `/outlets` | HQ, superadmin | `{ name, address? }` |
| GET | `/users` | superadmin | List users (paginated) |
| POST | `/users` | superadmin | `{ username, password, role, outletId? }` (outletId required for outletadmin) |
| GET | `/menu` | HQ, superadmin | Master menu (paginated) |
| POST | `/menu` | HQ, superadmin | Create master item `{ name, description?, basePrice }` |
| POST | `/menu/assign` | HQ, superadmin | `{ outletId, menuItemId, price?, isActive? }`: assign to an outlet, optionally overriding the price |
| GET | `/menu/outlet/:outletId` | HQ; outlet admin (own outlet) | Only the items assigned to the outlet, with `outletPrice` and `isActive` |
| PUT | `/inventory` | HQ; outlet admin (own outlet) | Set an exact count `{ outletId, menuItemId, stock, expectedStock? }`. With `expectedStock`, returns 409 if stock changed since it was read |
| POST | `/inventory/adjust` | HQ; outlet admin (own outlet) | `{ outletId, menuItemId, delta }`: atomic add or remove (deliveries, waste). Never below 0 (409) |
| GET | `/inventory/outlet/:outletId` | HQ; outlet admin (own outlet) | Stock per item |
| POST | `/sales` | HQ (send `outletId`); outlet admin | `{ items: [{ menuItemId, quantity }] }`. Optional `Idempotency-Key` header (same key + same items returns the original sale; same key + different items returns 422). Returns 201 `{ sale, items, receiptNumber, totalAmount }`. Returns 409 on insufficient stock and 422 for items not sold at the outlet |
| GET | `/sales/outlet/:outletId` | HQ; outlet admin (own outlet) | Sales, newest first (paginated) |
| GET | `/sales/:saleId` | HQ; outlet admin (own outlet) | Receipt with line items |
| GET | `/reports/revenue-by-outlet` | HQ (all outlets); outlet admin (own) | **Total revenue by outlet** `?dateFrom=&dateTo=` |
| GET | `/reports/outlet/:outletId/top-items` | HQ; outlet admin (own outlet) | **Top 5 selling items** `?limit=5&dateFrom=&dateTo=` |
| GET | `/reports/outlet/:outletId/summary` | HQ; outlet admin (own outlet) | Transaction count and revenue |
| GET | `/health`, `/health/ready` | public | Liveness / readiness (DB and Redis) |

- **Pagination:** cursor (keyset) based: `?limit=20&cursor=<nextCursor>`, with `limit` capped at 100. Responses are `{ items, nextCursor, hasMore, limit }`; pass `nextCursor` back to get the next page (`null` on the last page). Every page costs the same at any depth, there's no `COUNT(*)`, and results don't shift while new rows arrive.
- **Dates:** `YYYY-MM-DD`, inclusive, in UTC.

Example sale:

```bash
curl -X POST http://localhost:3000/api/sales \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -H "Idempotency-Key: 6f1c2e4a-order-1" \
  -d '{"items":[{"menuItemId":1,"quantity":2},{"menuItemId":5,"quantity":1}]}'
```

## Schema

Full reference: [docs/SCHEMA.md](docs/SCHEMA.md). Diagram: [docs/ERD.svg](docs/ERD.svg).

![ERD](docs/ERD.svg)

| Table | Purpose | Key constraints |
|---|---|---|
| `outlets` | Outlets, plus `receipt_seq` (last receipt number) | unique name (case-insensitive) |
| `users` | Users with role and outlet | unique username; `CHECK` outletadmin ⇒ outlet_id |
| `tokens` | Refresh sessions (`jti`, status active/consumed/revoked) | unique jti |
| `menu_items` | HQ master menu with `base_price` | unique name; `CHECK base_price >= 0` |
| `outlet_menu_items` | Assignment of an item to an outlet, with optional `price` override and `is_active` | unique (outlet, item) |
| `inventory` | Stock per outlet per item | unique (outlet, item); **`CHECK stock >= 0`** |
| `sales` | Sale header: receipt number, total, idempotency key, creator | unique (outlet, receipt_number); unique (outlet, idempotency_key) |
| `sale_items` | Lines, with `price_at_sale` snapshot | `CHECK quantity > 0` |

Two **daily rollup tables**, `outlet_daily_sales` and `outlet_item_daily_sales`, are updated inside each sale's transaction, and reports read only those (see below).

Every table has foreign keys. Indexes match the queries:
- `sales (outlet_id, created_at, id)` serves the newest-first sales list, read backwards.
- `(name, id)` on outlets and menu items serves their keyset pages.
- The unique (outlet, item) indexes serve menu and stock lookups.
- The rollup primary keys serve every report.

### How the core requirements are guaranteed

All of these run inside one database transaction per sale:

- **Only assigned items can be sold.** Prices are resolved as `COALESCE(override, base_price)`, and only for items assigned and active at the outlet.
- **Sequential receipts per outlet under concurrency:** the sale first runs `UPDATE outlets SET receipt_seq = receipt_seq + 1 … RETURNING`. The row lock serialises sales within one outlet, and a rolled-back sale gives its number back, so the series has no gaps. Different outlets never block each other.
- **No negative stock, even under concurrency:**
  1. all lines are deducted in **one conditional `UPDATE … WHERE stock >= qty`**
  2. any line that couldn't be deducted rolls back the whole sale (409)
  3. `CHECK (stock >= 0)` backs it up at the database level
  4. because sales of an outlet are already serialised on the receipt counter, they never contend or deadlock on stock rows
- **Bounded waiting:** a lock wait over 5 s returns 503 "busy, retry". Each process allows at most `DB_POOL_MAX − 2` concurrent sale transactions, so a burst at one outlet can't starve other requests of connections.
- **Safe retries:** sending the same `Idempotency-Key` returns the original sale instead of creating a second one. Reusing a key for a different basket is rejected with 422.

Integration tests cover all of this. For example, 40 concurrent sales against a stock of 20 produce exactly 20 sales with receipts 1–20, and stock ends at 0. Another test reconciles the report rollups against the raw tables after the whole flow.

### Measured at scale (2 million sales)

| Query | Before | Now |
|---|---|---|
| Sales list, page halfway through (500k rows deep) | 89 ms (OFFSET), plus 150 ms `COUNT(*)` per request | **0.08 ms** (keyset) |
| Report: outlet summary | 142 ms | **0.05 ms** (rollup) |
| Report: top 5 items | 741 ms | **0.25 ms** (rollup) |
| Report: revenue by outlet | 682 ms | **0.09 ms** (rollup) |

| Load test (pool of 10 connections) | Result |
|---|---|
| 300 concurrent sales at one outlet | All succeed, at about 240 sales/s through that outlet's lock |
| 100 concurrent reads at another outlet, during that burst | p95 20 ms |

## Architecture

Full write-up: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

```
Browser (React SPA) ──► nginx / static host ──► Express API (stateless, N replicas) ──► PostgreSQL (source of truth)
                                                       └──► Redis (token blacklist, rate limits, menu cache — optional)
```

- **Layered backend.** Each domain module has `routes.ts` (URL, auth, role guard, validation), `controller.ts` (HTTP), `service.ts` (business rules and transactions), `repository.ts` (SQL via Drizzle) and `validation.ts` (zod).
- **One error middleware** maps application, validation and PostgreSQL errors to the envelope: 422 validation, 401/403 auth, 409 conflicts, 503 when the DB is unavailable, and 500 without leaking internals.
- **Security:**
  - argon2id passwords with constant-time login
  - short-lived access JWTs plus rotating refresh tokens with reuse detection
  - token type, issuer and audience checks
  - Redis blacklist with Postgres fallback
  - rate limiting shared across instances
  - helmet, CORS allowlist and body size limit
  - production refuses to boot with a weak or missing JWT secret
  - non-root containers
- **Operations:**
  - structured pino logs with `x-request-id`
  - liveness and readiness endpoints
  - graceful shutdown on SIGTERM
  - versioned SQL migrations run by a compiled migrator, as a one-off job

## Scaling strategy

Full plan: [docs/SCALING.md](docs/SCALING.md).

Summary for the target of **10 outlets and about 100k transactions per month**:

- **What the load means.** That is about 3.3k sales a day and under 1 sale per second at peak. A single PostgreSQL primary handles it comfortably, so the priorities are correctness, availability and report speed.
- **Database:**
  - managed Postgres with an HA standby and point-in-time recovery
  - PgBouncer once there are multiple API replicas
  - a read replica for reports
  - later, monthly partitions on `sales` and `sale_items`, and sharding by `outlet_id` only at hundreds of outlets
- **Reporting:**
  - reports already read daily rollups maintained in the sale transaction (implemented)
  - reports served from a read replica
  - async exports to S3
  - CDC into a warehouse for BI
- **Infrastructure:**
  - 2–3 stateless API replicas behind a load balancer
  - a CDN for the SPA
  - managed Redis
  - central logs, metrics and alerts
  - migrations as a gated CI/CD step
- **Evolution:**
  - modular monolith first, then a transactional outbox with `sale.created` events
  - then extract Reporting and Identity ([docs/MICROSERVICES.md](docs/MICROSERVICES.md))
  - offline outlet hubs that sync idempotently ([docs/OFFLINE_POS.md](docs/OFFLINE_POS.md))

## Project structure

```
.
├── docs/                       # architecture, schema + ERD, scaling, microservices, offline POS, deploy
├── orchestrate/
│   ├── compose.yml             # app services on the external common-net network
│   ├── backend/                # API Dockerfile, entrypoint, migration/seed job images, env example
│   └── frontend/               # nginx Dockerfile + config
├── render.yaml                 # Render blueprint
└── source/
    ├── backend/
    │   ├── drizzle/            # SQL migrations
    │   ├── src/
    │   │   ├── index.ts        # server bootstrap
    │   │   ├── app.ts          # Express app
    │   │   ├── modules/<module>/{routes,controller,service,repository,validation}.ts
    │   │   ├── scripts/seed.ts
    │   │   └── shared/{config,db,utils}
    │   └── tests/<module>/     # validation unit tests + PostgreSQL integration tests
    └── frontend/
        └── src/{api,components,constants,lib,pages,store}
```

## Further documentation

| Document | Contents |
|---|---|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Components, layers, security model, sale transaction |
| [SCHEMA.md](docs/SCHEMA.md) / [ERD.svg](docs/ERD.svg) | Tables, constraints, indexes, relationships |
| [SCALING.md](docs/SCALING.md) | Scaling plan for 10 outlets and 100k transactions per month, and beyond |
| [MICROSERVICES.md](docs/MICROSERVICES.md) | How and why to split into services |
| [OFFLINE_POS.md](docs/OFFLINE_POS.md) | Offline sales sync and POS-to-KDS communication without internet |
| [RENDER_DEPLOY.md](docs/RENDER_DEPLOY.md) | Deploying the stack to Render |
