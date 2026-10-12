# Deploying to Render

The repository includes a Render Blueprint, [`render.yaml`](../render.yaml). It creates:

| Resource       | Type                 | Notes                                                       |
|----------------|----------------------|-------------------------------------------------------------|
| `pos-db`       | PostgreSQL (free)    | Render creates PostgreSQL 18 by default. Free databases expire after 30 days |
| `pos-redis`    | Key Value (free)     | Internal only (`ipAllowList: []`)                           |
| `pos-backend`  | Web service, Node 24 | Runs migrations and the idempotent seed, then starts the API |
| `pos-frontend` | Static site          | SPA rewrite, long cache on hashed assets                    |

## Steps

1. Push the repository to GitHub.
2. In Render, go to **Blueprints → New Blueprint Instance** and select the repository.
3. When prompted:
   - **`CORS_ORIGINS`:** the frontend URL, e.g. `https://pos-frontend.onrender.com`. You can fill it in after the first deploy. Left empty, the API accepts any origin, which is acceptable because auth uses bearer tokens, not cookies.
4. Apply. Render provisions the database and Redis, then builds and deploys both services. `JWT_SECRET` and `SEED_PASSWORD` are generated automatically.
5. Get the demo users' password from **pos-backend → Environment → `SEED_PASSWORD`**. It is never stored in the repo, so share it with reviewers privately. To use a password of your own, edit `SEED_PASSWORD` there; Render redeploys and the seed updates the demo accounts to the new value.
6. Open the frontend URL and sign in with one of the demo users from the [README](../README.md#demo-users).

Check the deployment:

- `GET https://<backend>/health/ready` should return `{"database":"up","redis":"up"}`.
- API docs are at `https://<backend>/docs` (`API_DOCS=true` in the blueprint).

## Notes

- **Cold starts:** free web services sleep after about 15 minutes idle, so the first request can take around a minute.
- **Migrations and seed on boot** are safe even with several instances, because both take PostgreSQL advisory locks. On a paid plan, prefer moving `node dist/shared/db/migrate.js` to a **pre-deploy command** (so a failed migration blocks the deploy), and drop the demo seed for real data.
- **Frontend API URL:** the frontend reads the backend URL at build time (`VITE_API_BASE_URL`, taken from the backend's `RENDER_EXTERNAL_URL`).
  - If the frontend ends up calling the wrong address (for example because Render gave the backend a different URL), set `VITE_API_BASE_URL` on `pos-frontend` by hand to the backend's URL.
  - After that, or whenever the backend URL changes, redeploy the frontend with **Clear build cache & deploy**.

## Other platforms

The same images run anywhere containers run:

```bash
docker build -f orchestrate/backend/Dockerfile -t pos-backend .
docker build -f orchestrate/frontend/Dockerfile -t pos-frontend .

docker run --rm -e DATABASE_URL=... -e JWT_SECRET=... pos-backend migrate
docker run -d -p 3000:3000 -e DATABASE_URL=... -e REDIS_URL=... -e JWT_SECRET=... pos-backend
```

## Pre-deploy verification

The blueprint and the deploy were checked locally before any real deploy:

- **Schema:** `render.yaml` validates against Render's published JSON Schema (`render.com/schema/render.yaml.json`).
- **Dress rehearsal:**
  - Environment: a Linux `node:24` container with PostgreSQL 18 and Valkey 8 (what Render provisions). It used the exact `buildCommand` and `startCommand`, `PORT=10000`, a generated `JWT_SECRET` and `SEED_PASSWORD`, and `CORS_ORIGINS` left blank.
  - Results: the build succeeds and dev dependencies are pruned. Two instances booting at the same time (as in a zero-downtime deploy) apply migrations once and seed once, thanks to advisory locks. A restart is a no-op for migrations and the seed. Login with the generated password, sales, reports and `/docs` all work.
- **Frontend:** the static site build bakes in the backend URL.

