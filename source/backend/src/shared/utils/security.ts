import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import type { RequestHandler } from 'express';
import { config } from '../config';

const corsMiddleware = cors({
  // Empty allowlist reflects any origin (dev convenience). Auth is bearer-token based, not cookies,
  // so this does not open a CSRF vector; production should still set CORS_ORIGINS.
  origin: config.cors.origins.length ? config.cors.origins : true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Idempotency-Key'],
  exposedHeaders: ['X-Request-Id', 'Idempotent-Replayed', 'RateLimit', 'RateLimit-Policy', 'Retry-After'],
  maxAge: 600,
});

export const securityMiddleware: RequestHandler[] = [helmet(), corsMiddleware, compression()];
