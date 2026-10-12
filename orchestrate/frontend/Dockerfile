# syntax=docker/dockerfile:1
# Static SPA served by nginx, which also reverse-proxies /api to the backend (same origin: no CORS).
# Build from the repo root: docker build -f orchestrate/frontend/Dockerfile .

FROM node:24-alpine AS build
WORKDIR /app
COPY source/frontend/package.json source/frontend/package-lock.json ./
RUN npm ci
COPY source/frontend/ .
# Empty = call the API on the same origin through the nginx proxy below.
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

FROM nginx:1.30-alpine
COPY orchestrate/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
