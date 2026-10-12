import { describe, expect, it } from 'vitest';
import { createOutletBodySchema } from '../../src/modules/outlets/validation';

const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) => schema.safeParse(v).success;

describe('outlets validation', () => {
  it('requires a name and trims it', () => {
    expect(createOutletBodySchema.parse({ name: '  Main  ' }).name).toBe('Main');
    expect(ok(createOutletBodySchema, { name: '   ' })).toBe(false);
  });

  it('turns a blank address into undefined (stored as NULL)', () => {
    expect(createOutletBodySchema.parse({ name: 'X', address: '   ' }).address).toBeUndefined();
  });
});
