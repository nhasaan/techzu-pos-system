import { describe, expect, it } from 'vitest';
import type { Request } from 'express';
import { issueTokenPair } from '../../src/shared/utils/jwt';
import { apiKey, loginKey, refreshKey } from '../../src/shared/utils/rate-limit';

const req = (over: Partial<Request> & { headers?: Record<string, string> }) =>
  ({ ip: '203.0.113.7', headers: {}, body: {}, socket: {}, ...over }) as unknown as Request;

describe('rate-limit keys', () => {
  const cashierA = issueTokenPair({ id: 1, username: 'a', role: 'outletadmin', outletId: 1 });
  const cashierB = issueTokenPair({ id: 2, username: 'b', role: 'outletadmin', outletId: 1 });

  it('limits authenticated traffic per user, so terminals behind one NAT IP do not share a bucket', () => {
    const a = apiKey(req({ headers: { authorization: `Bearer ${cashierA.accessToken}` } }));
    const b = apiKey(req({ headers: { authorization: `Bearer ${cashierB.accessToken}` } }));
    expect(a).toBe('u:1');
    expect(b).toBe('u:2');
  });

  it('groups IPv6 clients by subnet so address rotation does not bypass limits', () => {
    const a = apiKey(req({ ip: '2001:db8:abcd:12::1' }));
    const b = apiKey(req({ ip: '2001:db8:abcd:12:ffff::9' }));
    expect(a).toBe(b);
  });

  it('falls back to the IP for anonymous or forged tokens', () => {
    expect(apiKey(req({}))).toBe('ip:203.0.113.7');
    expect(apiKey(req({ headers: { authorization: 'Bearer forged.token.value' } }))).toBe('ip:203.0.113.7');
  });

  it('keys login attempts by IP + username (case-insensitive)', () => {
    expect(loginKey(req({ body: { username: ' James.Wilson ' } }))).toBe('203.0.113.7:james.wilson');
    expect(loginKey(req({ body: { username: 'david.kim' } }))).not.toBe(loginKey(req({ body: { username: 'emma.lee' } })));
  });

  it('keys refresh by the user inside the refresh token', () => {
    expect(refreshKey(req({ body: { refreshToken: cashierA.refreshToken } }))).toBe('u:1');
    expect(refreshKey(req({ body: { refreshToken: 'junk' } }))).toBe('ip:203.0.113.7');
  });
});
