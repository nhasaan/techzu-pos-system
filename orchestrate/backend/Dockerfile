# syntax=docker/dockerfile:1
# Production image for the API. Build from the repo root:
#   docker build -f orchestrate/backend/Dockerfile -t pos-backend .
# The same image runs migrations and the seed: `docker run pos-backend migrate|seed`.

ARG NODE_VERSION=24-alpine

# ---- deps: full install (cached until the lockfile changes) ----
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
COPY source/backend/package.json source/backend/package-lock.json ./
RUN npm ci

# ---- build: compile TypeScript ----
FROM deps AS build
COPY source/backend/ .
RUN npm run build

# ---- prod-deps: runtime dependencies only ----
FROM node:${NODE_VERSION} AS prod-deps
WORKDIR /app
COPY source/backend/package.json source/backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---- runtime: small, non-root ----
FROM node:${NODE_VERSION} AS runtime
RUN apk add --no-cache tini
WORKDIR /app
ENV NODE_ENV=production PORT=3000

RUN addgroup -g 1001 -S app && adduser -S app -u 1001 -G app -s /sbin/nologin

COPY --from=prod-deps --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/dist ./dist
COPY --chown=app:app source/backend/drizzle ./drizzle
COPY --chown=app:app source/backend/package.json ./package.json
COPY --chown=app:app orchestrate/backend/bin/entrypoint.sh ./bin/entrypoint.sh
RUN chmod +x ./bin/entrypoint.sh

USER app
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/health >/dev/null || exit 1

# tini reaps zombies and forwards SIGTERM so graceful shutdown works.
ENTRYPOINT ["/sbin/tini", "--", "./bin/entrypoint.sh"]
CMD ["start"]
