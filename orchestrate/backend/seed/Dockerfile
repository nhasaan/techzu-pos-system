# syntax=docker/dockerfile:1
# One-off seed job. Reuses the API image stages, so it shares the build cache.
# Build from the repo root: docker build -f orchestrate/backend/seed/Dockerfile .
# (docker compose runs the same thing via the backend image: `--profile db-job run --rm seed`.)
ARG NODE_VERSION=24-alpine

FROM node:${NODE_VERSION} AS build
WORKDIR /app
COPY source/backend/package.json source/backend/package-lock.json ./
RUN npm ci
COPY source/backend/ .
RUN npm run build && npm prune --omit=dev

FROM node:${NODE_VERSION}
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 -S app && adduser -S app -u 1001 -G app -s /sbin/nologin
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/dist ./dist
COPY --chown=app:app source/backend/drizzle ./drizzle
USER app
CMD ["node", "dist/scripts/seed.js"]
