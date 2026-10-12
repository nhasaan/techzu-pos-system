import rateLimit, { MemoryStore, type Options, type Store, type ClientRateLimitInfo } from 'express-rate-limit';
import { config } from '../config';
import type { Request } from 'express';
import { verifyToken } from './jwt';
import { fail } from './response';
import { isRedisReady, redis } from './redis';

/**
 * Fixed-window counter in Redis so limits hold across all API instances.
 * Falls back to per-process memory when Redis is unavailable.
 */
class RedisWithMemoryFallbackStore implements Store {
  private windowMs = 60_000;
  private readonly memory = new MemoryStore();

  constructor(public readonly prefix: string) {}

  init(options: Options) {
    this.windowMs = options.windowMs;
    this.memory.init(options);
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    if (isRedisReady()) {
      try {
        const k = this.prefix + key;
        const res = await redis.multi().set(k, '0', 'PX', this.windowMs, 'NX').incr(k).pttl(k).exec();
        const totalHits = Number(res?.[1]?.[1] ?? 1);
        const ttl = Number(res?.[2]?.[1] ?? this.windowMs);
        return { totalHits, resetTime: new Date(Date.now() + (ttl > 0 ? ttl : this.windowMs)) };
      } catch {
        // fall through to memory
      }
    }
    return this.memory.increment(key);
  }

  async decrement(key: string) {
    if (isRedisReady()) {
      try {
        await redis.decr(this.prefix + key);
        return;
      } catch {
        // fall through
      }
    }
    await this.memory.decrement(key);
  }

  async resetKey(key: string) {
    if (isRedisReady()) await redis.del(this.prefix + key).catch(() => undefined);
    await this.memory.resetKey(key);
  }
}

const tooMany = fail('Too many requests, please try again later.', { rate: 'Limit exceeded' });

const clientIp = (req: Request) => req.ip ?? req.socket.remoteAddress ?? 'unknown';

/**
 * Who a request counts against. All terminals of an outlet usually share one public (NAT) IP, so
 * per-IP limits would make an outlet's cashiers throttle each other. Requests carrying a valid token
 * are therefore limited per user; only anonymous traffic falls back to the IP.
 */
export function apiKey(req: Request): string {
  const header = req.headers.authorization;
  const token = header?.toLowerCase().startsWith('bearer ') ? header.slice(7) : null;
  const claims = token ? (verifyToken(token, 'access') ?? verifyToken(token, 'refresh')) : null;
  return claims ? `u:${claims.userId}` : `ip:${clientIp(req)}`;
}

/** Login attempts per (username, IP): stops brute force on an account without locking out a whole outlet. */
export function loginKey(req: Request): string {
  const username = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase().slice(0, 64) : '';
  return `${clientIp(req)}:${username}`;
}

/** Refresh attempts per user (from the refresh token), falling back to the IP for junk tokens. */
export function refreshKey(req: Request): string {
  const token = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : '';
  const claims = token ? verifyToken(token, 'refresh') : null;
  return claims ? `u:${claims.userId}` : `ip:${clientIp(req)}`;
}

function limiter(name: string, max: number, keyGenerator: (req: Request) => string, windowMs = config.rateLimit.windowMs) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    store: new RedisWithMemoryFallbackStore(`rl:${name}:`),
    keyGenerator,
    message: tooMany,
    skip: () => config.isTest,
  });
}

/** General API protection, per user (per IP for anonymous requests). */
export const apiLimiter = limiter('api', config.rateLimit.max, apiKey);
/** Brute-force protection for one account. */
export const loginLimiter = limiter('login', config.rateLimit.loginMax, loginKey);
/** Password-spraying protection: many usernames from one address (generous enough for a busy outlet). */
export const loginIpLimiter = limiter('login-ip', config.rateLimit.loginMax * 10, (req) => clientIp(req));
export const refreshLimiter = limiter('refresh', config.rateLimit.loginMax * 3, refreshKey);
