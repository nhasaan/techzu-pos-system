import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pool } from '../../src/shared/db';
import { api, bearer, createUser, login, PASSWORD, setupDatabase, teardownDatabase } from '../helpers';

describe('auth', () => {
  beforeAll(async () => {
    await setupDatabase();
    await createUser('admin', 'superadmin');
  });
  afterAll(teardownDatabase);

  it('rejects bad credentials with the same message for unknown users', async () => {
    const a = await api().post('/api/auth/login').send({ username: 'admin', password: 'wrong' });
    const b = await api().post('/api/auth/login').send({ username: 'ghost', password: PASSWORD });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.message).toBe(b.body.message);
  });

  it('rejects requests without or with malformed tokens', async () => {
    expect((await api().get('/api/outlets')).status).toBe(401);
    expect((await api().get('/api/outlets').set(bearer('not-a-jwt'))).status).toBe(401);
  });

  it('does not accept a refresh token as an access token', async () => {
    const { refreshToken } = await login('admin');
    const res = await api().get('/api/outlets').set(bearer(refreshToken));
    expect(res.status).toBe(401);
  });

  it('rotates refresh tokens and revokes every session on reuse', async () => {
    const first = await login('admin');
    const rotated = await api().post('/api/auth/refresh').send({ refreshToken: first.refreshToken }).expect(200);
    const second = rotated.body.data;
    expect(second.refreshToken).not.toBe(first.refreshToken);
    await api().get('/api/outlets').set(bearer(second.accessToken)).expect(200);

    // A stolen token is replayed later than the near-simultaneous retry window.
    await pool.query("UPDATE tokens SET consumed_at = now() - interval '1 minute' WHERE status = 'consumed'");
    const replay = await api().post('/api/auth/refresh').send({ refreshToken: first.refreshToken });
    expect(replay.status).toBe(401);
    expect(replay.body.message).toMatch(/reuse/i);

    // The session created from the rotated token is revoked too.
    expect((await api().get('/api/outlets').set(bearer(second.accessToken))).status).toBe(401);
    expect((await api().post('/api/auth/refresh').send({ refreshToken: second.refreshToken })).status).toBe(401);
  });

  it('lets only one of two concurrent refreshes win without killing the winner', async () => {
    const { refreshToken } = await login('admin');
    const results = await Promise.all([1, 2].map(() => api().post('/api/auth/refresh').send({ refreshToken })));
    expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
    // Two tabs refreshing at once is not token theft: the winning session must stay valid.
    const winner = results.find((r) => r.status === 200)!.body.data;
    await api().get('/api/outlets').set(bearer(winner.accessToken)).expect(200);
    await api().post('/api/auth/refresh').send({ refreshToken: winner.refreshToken }).expect(200);
  });

  it('logout invalidates the access token', async () => {
    const { accessToken } = await login('admin');
    await api().post('/api/auth/logout').set(bearer(accessToken)).expect(200);
    const res = await api().get('/api/outlets').set(bearer(accessToken));
    expect(res.status).toBe(401);
    expect(res.body.errors).toEqual({ token: 'Revoked' });
  });
});
