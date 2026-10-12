import { describe, expect, it } from 'vitest';
import { setStockBodySchema } from '../../src/modules/inventory/validation';

const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) => schema.safeParse(v).success;

describe('inventory validation', () => {
  it('rejects negative stock', () => {
    expect(ok(setStockBodySchema, { outletId: 1, menuItemId: 1, stock: 0 })).toBe(true);
    expect(ok(setStockBodySchema, { outletId: 1, menuItemId: 1, stock: -1 })).toBe(false);
  });
});
