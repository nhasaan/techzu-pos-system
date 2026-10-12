import { cacheGet, cacheIncr, cacheSet } from '../../shared/utils/redis';

// Cache-aside for the outlet menu (the hottest read: every POS terminal loads it).
// Invalidation is exact: assignments bump a per-outlet version that is part of every cache key,
// so stale pages are simply never read again and expire on their own.
const TTL_SEC = 300;
const versionKey = (outletId: number) => `menu:outlet:${outletId}:ver`;
const pageKey = (outletId: number, version: string, cursor: string | undefined, limit: number) =>
  `menu:outlet:${outletId}:v${version}:c${cursor ?? ''}:l${limit}`;

export const outletMenuCache = {
  async get<T>(outletId: number, cursor: string | undefined, limit: number): Promise<{ value: T | null; version: string }> {
    const version = (await cacheGet(versionKey(outletId))) ?? '0';
    const raw = await cacheGet(pageKey(outletId, version, cursor, limit));
    return { value: raw ? (JSON.parse(raw) as T) : null, version };
  },

  async set(outletId: number, version: string, cursor: string | undefined, limit: number, value: unknown) {
    await cacheSet(pageKey(outletId, version, cursor, limit), JSON.stringify(value), TTL_SEC);
  },

  async invalidate(outletId: number) {
    await cacheIncr(versionKey(outletId));
  },
};
