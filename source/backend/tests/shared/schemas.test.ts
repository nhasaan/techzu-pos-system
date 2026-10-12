import { describe, expect, it } from 'vitest';
import { outletIdParamSchema } from '../../src/shared/utils/schemas';
import { cursorQuerySchema, decodeCursor, encodeCursor, nameIdKey, timestampIdKey, toCursorPage } from '../../src/shared/utils/pagination';

const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) => schema.safeParse(v).success;

describe('shared schemas', () => {
  it('applies cursor pagination defaults and caps the limit at 100', () => {
    expect(cursorQuerySchema.parse({})).toEqual({ limit: 20 });
    expect(cursorQuerySchema.parse({ limit: '50' }).limit).toBe(50);
    expect(ok(cursorQuerySchema, { limit: '101' })).toBe(false);
    expect(ok(cursorQuerySchema, { cursor: 'not base64url!' })).toBe(false);
  });

  it('round-trips cursors and rejects tampered ones', () => {
    const c = encodeCursor(['Latte', 42]);
    expect(decodeCursor(c, nameIdKey)).toEqual(['Latte', 42]);
    expect(decodeCursor(undefined, nameIdKey)).toBeUndefined();
    expect(() => decodeCursor(encodeCursor(['Latte', 'x']), nameIdKey)).toThrow(/Invalid cursor/);
    expect(() => decodeCursor('bm90LWpzb24', nameIdKey)).toThrow(/Invalid cursor/);
    expect(() => decodeCursor(encodeCursor(['DROP TABLE', 1]), timestampIdKey)).toThrow(/Invalid cursor/);
  });

  it('builds pages from limit + 1 rows without counting', () => {
    const rows = [1, 2, 3].map((id) => ({ id, name: `n${id}` }));
    const page = toCursorPage(rows, 2, (r) => [r.name, r.id]);
    expect(page.items).toHaveLength(2);
    expect(page.hasMore).toBe(true);
    expect(decodeCursor(page.nextCursor!, nameIdKey)).toEqual(['n2', 2]);
    expect(toCursorPage(rows.slice(0, 2), 2, (r) => [r.name, r.id])).toMatchObject({ hasMore: false, nextCursor: null });
  });

  it('parses numeric path ids and rejects junk', () => {
    expect(outletIdParamSchema.parse({ outletId: '42' })).toEqual({ outletId: 42 });
    for (const bad of ['0', '-1', 'abc', '1.5', '99999999999999999']) expect(ok(outletIdParamSchema, { outletId: bad })).toBe(false);
  });
});
