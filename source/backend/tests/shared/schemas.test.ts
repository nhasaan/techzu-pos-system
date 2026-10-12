import { describe, expect, it } from 'vitest';
import { outletIdParamSchema, paginationQuerySchema } from '../../src/shared/utils/schemas';

const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) => schema.safeParse(v).success;

describe('shared schemas', () => {
  it('applies pagination defaults and coerces strings', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
    expect(paginationQuerySchema.parse({ page: '3', limit: '50' })).toEqual({ page: 3, limit: 50 });
  });

  it('caps pagination limit at 100', () => {
    expect(ok(paginationQuerySchema, { limit: '101' })).toBe(false);
  });

  it('parses numeric path ids and rejects junk', () => {
    expect(outletIdParamSchema.parse({ outletId: '42' })).toEqual({ outletId: 42 });
    for (const bad of ['0', '-1', 'abc', '1.5', '99999999999999999']) expect(ok(outletIdParamSchema, { outletId: bad })).toBe(false);
  });
});
