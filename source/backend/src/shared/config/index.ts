import fs from 'fs';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

const DEV_JWT_SECRET = 'dev-only-insecure-secret-change-me-please-32ch';

const boolString = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((v) => v === 'true' || v === '1');

const csv = z
  .string()
  .optional()
  .transform((v) =>
    (v ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => (/^https?:\/\//.test(s) ? s : `https://${s}`)),
  );

const expiry = z.string().regex(/^\d+[smhd]$/, 'Expiry must look like 15m, 24h, 7d');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

    DATABASE_URL: z.string().url().default('postgres://postgres:postgres@localhost:5432/pos_db'),
    DATABASE_SSL: boolString,
    DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
    DB_STATEMENT_TIMEOUT_MS: z.coerce.number().int().min(0).default(10000),
    DB_LOCK_TIMEOUT_MS: z.coerce.number().int().min(0).default(5000),

    REDIS_URL: z.string().default('redis://localhost:6379'),

    JWT_SECRET: z.string().optional(),
    JWT_PRIVATE_KEY_PATH: z.string().optional(),
    JWT_PUBLIC_KEY_PATH: z.string().optional(),
    JWT_ACCESS_TOKEN_EXPIRY: expiry.default('15m'),
    JWT_REFRESH_TOKEN_EXPIRY: expiry.default('7d'),

    CORS_ORIGINS: csv,
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),

    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60_000),
    RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(300),
    LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(10),

    API_DOCS: z.enum(['true', 'false']).optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    const hasKeys = Boolean(env.JWT_PRIVATE_KEY_PATH?.trim() && env.JWT_PUBLIC_KEY_PATH?.trim());
    if (!hasKeys && (!env.JWT_SECRET || env.JWT_SECRET.length < 32)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET (>= 32 chars) or RS256 key paths are required in production',
      });
    }
  });

function loadJwtKeys(privatePath?: string, publicPath?: string) {
  const priv = privatePath?.trim();
  const pub = publicPath?.trim();
  if (!priv || !pub) return null;
  if (!fs.existsSync(priv) || !fs.existsSync(pub)) {
    throw new Error(`JWT key files not found: ${priv}, ${pub}`);
  }
  return { privateKey: fs.readFileSync(priv, 'utf8'), publicKey: fs.readFileSync(pub, 'utf8') };
}

function parseExpiryToSeconds(value: string): number {
  const n = parseInt(value, 10);
  const unit = value.slice(-1);
  const mult: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return n * mult[unit];
}

function loadConfig() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  const env = parsed.data;
  const keys = loadJwtKeys(env.JWT_PRIVATE_KEY_PATH, env.JWT_PUBLIC_KEY_PATH);

  return {
    env: env.NODE_ENV,
    isProd: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    db: {
      url: env.DATABASE_URL,
      ssl: env.DATABASE_SSL,
      poolMax: env.DB_POOL_MAX,
      statementTimeoutMs: env.DB_STATEMENT_TIMEOUT_MS,
      lockTimeoutMs: env.DB_LOCK_TIMEOUT_MS,
    },
    redis: { url: env.REDIS_URL },
    jwt: keys
      ? { algorithm: 'RS256' as const, signKey: keys.privateKey, verifyKey: keys.publicKey }
      : {
          algorithm: 'HS256' as const,
          signKey: env.JWT_SECRET || DEV_JWT_SECRET,
          verifyKey: env.JWT_SECRET || DEV_JWT_SECRET,
        },
    tokens: {
      accessTtlSec: parseExpiryToSeconds(env.JWT_ACCESS_TOKEN_EXPIRY),
      refreshTtlSec: parseExpiryToSeconds(env.JWT_REFRESH_TOKEN_EXPIRY),
    },
    cors: { origins: env.CORS_ORIGINS },
    trustProxy: env.TRUST_PROXY,
    rateLimit: {
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX,
      loginMax: env.LOGIN_RATE_LIMIT_MAX,
    },
    // Swagger UI at /docs: on by default outside production, opt-in in production.
    apiDocs: env.API_DOCS ? env.API_DOCS === 'true' : env.NODE_ENV !== 'production',
  };
}

export const config = loadConfig();
export type AppConfig = typeof config;
