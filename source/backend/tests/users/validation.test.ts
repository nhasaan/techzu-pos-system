import { describe, expect, it } from 'vitest';
import { createUserBodySchema } from '../../src/modules/users/validation';

const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) => schema.safeParse(v).success;

describe('users validation', () => {
  const base = { username: 'jane.doe', password: 'longenough' };

  it('requires an outlet for outletadmin only', () => {
    expect(ok(createUserBodySchema, { ...base, role: 'outletadmin' })).toBe(false);
    expect(ok(createUserBodySchema, { ...base, role: 'outletadmin', outletId: 1 })).toBe(true);
    expect(ok(createUserBodySchema, { ...base, role: 'hqadmin' })).toBe(true);
  });

  it('enforces password length and allowed username characters', () => {
    expect(ok(createUserBodySchema, { ...base, password: 'short', role: 'hqadmin' })).toBe(false);
    expect(ok(createUserBodySchema, { ...base, username: 'bad name!', role: 'hqadmin' })).toBe(false);
  });

  it('rejects unknown roles (frontend must send backend role names)', () => {
    expect(ok(createUserBodySchema, { ...base, role: 'hq' })).toBe(false);
  });
});
