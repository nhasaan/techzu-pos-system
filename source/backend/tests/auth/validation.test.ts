import { describe, expect, it } from 'vitest';
import { loginBodySchema, refreshBodySchema } from '../../src/modules/auth/validation';

const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) => schema.safeParse(v).success;

describe('auth validation', () => {
  it('requires username and password', () => {
    expect(ok(loginBodySchema, { username: 'a', password: 'b' })).toBe(true);
    expect(ok(loginBodySchema, { username: '', password: 'b' })).toBe(false);
    expect(ok(loginBodySchema, { username: 'a' })).toBe(false);
  });

  it('requires refreshToken', () => {
    expect(ok(refreshBodySchema, { refreshToken: 'x' })).toBe(true);
    expect(ok(refreshBodySchema, {})).toBe(false);
  });
});
