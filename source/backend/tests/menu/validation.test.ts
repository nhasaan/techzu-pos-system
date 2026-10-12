import { describe, expect, it } from 'vitest';
import { assignToOutletBodySchema, createMenuItemBodySchema } from '../../src/modules/menu/validation';

const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) => schema.safeParse(v).success;

describe('menu validation', () => {
  it('accepts decimal strings and numbers for prices', () => {
    expect(createMenuItemBodySchema.parse({ name: 'Latte', basePrice: '4.5' }).basePrice).toBe('4.5');
    expect(createMenuItemBodySchema.parse({ name: 'Latte', basePrice: 4.5 }).basePrice).toBe('4.50');
  });

  it('rejects negative or over-precise prices', () => {
    for (const basePrice of ['-1', '1.234', 'abc', -2]) expect(ok(createMenuItemBodySchema, { name: 'X', basePrice })).toBe(false);
  });

  it('defaults isActive to true on assignment', () => {
    expect(assignToOutletBodySchema.parse({ outletId: 1, menuItemId: 2 }).isActive).toBe(true);
  });
});
