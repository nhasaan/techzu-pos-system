import Redis from 'ioredis';
import { config } from '../config';
import { logger } from './logger';

/**
 * Redis is an accelerator here (token blacklist, rate limits, menu cache), not a source of truth.
 * Commands fail fast while disconnected (no offline queue) and the client keeps reconnecting with
 * backoff, so a Redis outage degrades features instead of hanging requests.
 */
export const redis = new Redis(config.redis.url, {
  lazyConnect: config.isTest,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  connectTimeout: 3_000,
  retryStrategy: (times) => Math.min(times * 200, 5_000),
});

let lastErrorLogAt = 0;
redis.on('error', (err) => {
  // Throttle: a down Redis emits an error per reconnect attempt.
  if (Date.now() - lastErrorLogAt > 30_000) {
    lastErrorLogAt = Date.now();
    logger.warn({ err: err.message }, 'Redis unavailable; running in degraded mode');
  }
});
redis.on('ready', () => logger.info('Redis connected'));

export const isRedisReady = () => redis.status === 'ready';

export async function cacheGet(key: string): Promise<string | null> {
  if (!isRedisReady()) return null;
  try {
    return await redis.get(key);
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: string, ttlSec: number): Promise<boolean> {
  if (!isRedisReady()) return false;
  try {
    await redis.set(key, value, 'EX', Math.max(1, Math.ceil(ttlSec)));
    return true;
  } catch {
    return false;
  }
}

export async function cacheIncr(key: string): Promise<number | null> {
  if (!isRedisReady()) return null;
  try {
    return await redis.incr(key);
  } catch {
    return null;
  }
}

export async function closeRedis(): Promise<void> {
  try {
    await redis.quit();
  } catch {
    redis.disconnect();
  }
}
