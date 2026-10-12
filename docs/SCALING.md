# Scaling plan

**Target:** 10 outlets, about 100,000 transactions per month. This document covers what that load means, what the current design already handles, and how the system grows past it.

## 1. Sizing the target

| Metric                                        | Estimate                                                                 |
|-----------------------------------------------|--------------------------------------------------------------------------|
| Transactions / month                          | 100,000                                                                  |
| Average                                       | about 3,300/day, 0.04 tx/s                                               |
| Peak (F&B lunch and dinner, about 15× average) | about 0.6 tx/s system-wide; a busy outlet runs 1 tx every few seconds    |
| DB work per sale                              | about 7 statements in one transaction (a few ms)                         |
| Rows / year                                   | about 1.2 M `sales` and about 3 M `sale_items` (2.5 lines per sale)      |
| Storage / year                                | about 0.5–1 GB including indexes                                         |

A single PostgreSQL primary handles this easily. Write throughput is not the bottleneck at this scale. What matters is:

- correctness under concurrency, which is already handled
- availability during service hours
- report latency as history grows
- outlets that keep selling when the network drops

The sections below follow that order of priority.

## 2. Database scaling strategies

**Now (implemented)**

- Correctness is enforced in the database: row locks for stock and receipts, `CHECK` and `UNIQUE` constraints. Adding API replicas cannot break it.
- **Keyset (cursor) pagination on every list.** Cost per page is constant regardless of table size or depth, and there is no `COUNT(*)`. On 2M sales a page halfway through takes 0.08 ms, vs 89 ms with OFFSET.
- **Indexes match the access paths.** Examples: `sales (outlet_id, created_at, id)` for the newest-first list, `(name, id)` for outlets and menu, unique `(outlet_id, menu_item_id)` on assignments and stock. Partial indexes are used where most values are NULL.
- **Bounded connection use per instance.** `DB_POOL_MAX`, `statement_timeout`, `lock_timeout` (5 s → 503 "busy, retry"), `idle_in_transaction_session_timeout`, and a cap of `DB_POOL_MAX − 2` concurrent sale transactions per process.
- **Housekeeping.** Expired sessions are deleted hourly in batches.
- Receipt-counter contention is per outlet. Two outlets never wait on each other, and within an outlet the lock is held only for the commit (milliseconds).

**At the 10-outlet / 100k-per-month target**

- **Managed PostgreSQL with HA:** a synchronous standby with automatic failover, daily backups plus point-in-time recovery (WAL archiving), and a restore drill each quarter.
- **PgBouncer** in transaction-pooling mode once there are more than 2–3 API replicas. App pool × replicas must stay below `max_connections`.
- **One read replica** for reports and HQ dashboards. Writes and the sale transaction stay on the primary. Reports tolerate seconds of replication lag.
- **Autovacuum tuning** on the hot `inventory` rows (frequent updates). Monitor bloat.

**Beyond (10× or more)**

- **Partitioning** `sales` and `sale_items` by month (declarative range partitions on `created_at`). Old partitions can be detached to cold storage, and recent-data indexes stay small.
- **Archival:** move raw lines older than N years to object storage (Parquet) and keep the aggregates.
- **Sharding by outlet** (e.g. Citus) only at hundreds of outlets. `outlet_id` is already the natural shard key: every sale, stock row, and receipt sequence belongs to exactly one outlet.

## 3. Reporting performance

**Implemented: daily rollup tables.** `outlet_daily_sales (outlet_id, day, tx_count, revenue)` and `outlet_item_daily_sales (outlet_id, day, menu_item_id, quantity, revenue)` are updated inside every sale transaction, with one upsert statement after the outlet lock. "Revenue by outlet", "top 5 items" and the summary read only these, so their cost depends on the number of days in the range, not on the number of sales. Measured on 2M sales:

| Report | Raw tables | Rollups |
|---|---|---|
| Summary | 142 ms | 0.05 ms |
| Top 5 items | 741 ms | 0.25 ms |
| Revenue by outlet | 682 ms | 0.09 ms |

Next steps as volume grows:

1. **Coarser rollups.** Add monthly rollups if multi-year ranges become common. The pattern is the same.
2. **Read replica** for all report traffic, so it never competes with sales.
3. **Short-TTL cache** (30–60 s in Redis) for HQ dashboards, keyed by outlet and range. Requests for closed past periods can be cached much longer.
4. **Async exports:** large CSV or PDF exports run as queued jobs (BullMQ on Redis), stream rows with a cursor, upload to S3, and return a pre-signed URL.
5. **Analytics store** (BigQuery, ClickHouse, Redshift) fed by CDC (Debezium) or sale events when HQ needs ad-hoc BI. This keeps analytical load off the OLTP database entirely.

## 4. Infrastructure

| Layer         | Now                                    | 10 outlets / 100k per month                                       | Beyond                                         |
|---------------|----------------------------------------|-------------------------------------------------------------------|------------------------------------------------|
| API           | 1 container                            | 2–3 stateless replicas behind a load balancer (zero-downtime deploys) | Autoscaling on CPU and p95 latency (ECS / k8s HPA) |
| Database      | 1 Postgres                             | Managed Postgres with HA standby, PITR, 1 read replica, PgBouncer | Partitioning, more replicas, sharding by outlet |
| Redis         | 1 instance (optional)                  | Managed Redis with a replica                                      | Cluster mode                                   |
| Frontend      | nginx / static host                    | CDN (CloudFront / Cloudflare) in front of static assets           | Same                                           |
| Migrations    | One-off `migrate` job before deploy    | Same, gated in CI/CD; expand-and-contract for zero downtime       | Same                                           |
| Observability | pino JSON logs, request ids, `/health/ready` | Central logs (Loki / CloudWatch), metrics (Prometheus / OTel), alerts on 5xx, p95, DB connections, replication lag | Distributed tracing |
| Security      | helmet, rate limits, secrets via env   | WAF, secrets manager, private networking for DB and Redis, TLS everywhere | SSO for HQ users                           |

Why this works without redesign:

- The API is stateless, so scaling it horizontally is just adding replicas.
- Rate limits live in Redis, so they hold across replicas.
- Graceful shutdown (SIGTERM → drain → close pool) and readiness probes make rolling deploys safe.

## 5. Architectural evolution

1. **Today:** modular monolith. Strict module boundaries (routes → controller → service → repository per domain) and a single database. This is the right shape for 10 outlets and 100k transactions per month, with the least operational overhead.
2. **Next:** add an **outbox table** written in the sale transaction, plus a worker that publishes `sale.created` events. This decouples rollups, notifications, KDS, and accounting exports from the request path without risking lost events.
3. **Then:** split out read-heavy or independently-scaled parts. Reporting goes first, then a sync gateway for offline terminals. See [MICROSERVICES.md](MICROSERVICES.md).
4. **Edge:** offline-capable outlet servers that sync to HQ. See [OFFLINE_POS.md](OFFLINE_POS.md).

Each step is driven by a measured need (latency SLO, team ownership, deploy cadence), not by headcount of services.

## 6. Known trade-offs and next steps

These were reviewed and deliberately deferred. They aren't needed at the target scale, and each has a clear trigger.

| Item | Why it's deferred | Trigger to do it |
|---|---|---|
| Single-statement sale (PL/pgSQL or one CTE) | The critical section is already a handful of short statements under one outlet lock, at about 240 sales/s per outlet in the load test. | A single outlet needs more than about 200 sales/s. |
| `sale_items` keyed by `(sale_id, menu_item_id)`, dropping the surrogate id | Saves one index per line, but changes the API shape (`items[].id`). | Write amplification shows up on `sale_items`. |
| Index on `sales.created_by` | There's no user-deletion flow. Without it, an `ON DELETE SET NULL` would scan all sales. | A user-deletion feature is added. |
| Purging old idempotency keys | The partial index only holds keys clients actually send. | Index size matters. Then null keys older than the offline-sync window in batches. |
| Partitioning `sales` / `sale_items` by month | Not needed below hundreds of millions of rows. | Vacuum or index maintenance gets slow, or retention rules arrive. |
| Paid Render plans and multiple instances | The free tier is for the demo. Migrations and seed are already safe to run on concurrent boots. | Production use. |

