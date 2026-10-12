import rateLimit, { MemoryStore, type Options, type Store, type ClientRateLimitInfo } from 'express-rate-limit';
import { config } from '../config';
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

function limiter(name: string, max: number, windowMs = config.rateLimit.windowMs) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    store: new RedisWithMemoryFallbackStore(`rl:${name}:`),
    message: tooMany,
    skip: () => config.isTest,
  });
}

/** General API protection per client IP. */
export const apiLimiter = limiter('api', config.rateLimit.max);
/** Brute-force protection for credential endpoints. */
export const loginLimiter = limiter('login', config.rateLimit.loginMax);
export const refreshLimiter = limiter('refresh', config.rateLimit.loginMax * 3);
