import { describe, expect, it } from 'vitest';
import { createSaleBodySchema, idempotencyKeySchema } from '../../src/modules/sales/validation';

const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) => schema.safeParse(v).success;

describe('sales validation', () => {
  it('accepts items with optional outletId', () => {
    expect(ok(createSaleBodySchema, { items: [{ menuItemId: 1, quantity: 2 }] })).toBe(true);
    expect(ok(createSaleBodySchema, { outletId: 1, items: [{ menuItemId: 1, quantity: 1 }] })).toBe(true);
  });

  it('rejects empty items, zero quantity and bad ids', () => {
    expect(ok(createSaleBodySchema, { items: [] })).toBe(false);
    expect(ok(createSaleBodySchema, { items: [{ menuItemId: 1, quantity: 0 }] })).toBe(false);
    expect(ok(createSaleBodySchema, { items: [{ menuItemId: 0, quantity: 1 }] })).toBe(false);
  });

  it('validates the Idempotency-Key format', () => {
    expect(ok(idempotencyKeySchema, undefined)).toBe(true);
    expect(ok(idempotencyKeySchema, '3f2b-9c1d:retry.1')).toBe(true);
    expect(ok(idempotencyKeySchema, 'has spaces')).toBe(false);
    expect(ok(idempotencyKeySchema, 'x'.repeat(101))).toBe(false);
  });
});
