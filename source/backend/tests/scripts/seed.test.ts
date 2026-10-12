import { execFileSync } from 'child_process';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, setupDatabase, teardownDatabase } from '../helpers';

const SEED = path.resolve(__dirname, '../../src/scripts/seed.ts');

/** Runs the real seed script in a child process (as Render's start command does). */
function runSeed(env: Record<string, string>) {
  return execFileSync(process.execPath, ['--import', 'tsx', SEED], {
    env: {
      PATH: process.env.PATH ?? '',
      DATABASE_URL: process.env.DATABASE_URL ?? '',
      // Production config requires a strong JWT secret even for the seed process.
      JWT_SECRET: 'test-only-jwt-secret-0123456789abcdef',
      LOG_LEVEL: 'info',
      ...env,
    },
    encoding: 'utf8',
  });
}

const login = (password: string) => api().post('/api/auth/login').send({ username: 'sarah.chen', password });
const summary = (out: string) => JSON.parse(out.split('\n').find((l) => l.includes('Seed complete'))!);

describe('seed: demo user passwords', () => {
  beforeAll(setupDatabase);
  afterAll(teardownDatabase);

  it('creates the demo users with SEED_PASSWORD', async () => {
    const out = summary(runSeed({ NODE_ENV: 'production', SEED_PASSWORD: 'first-password-AAA' }));
    expect(out.createdUsers).toHaveLength(4);
    expect((await login('first-password-AAA')).status).toBe(200);
  });

  it('re-syncs existing demo users when SEED_PASSWORD changes, and ends their sessions', async () => {
    const before = await login('first-password-AAA');
    const out = summary(runSeed({ NODE_ENV: 'production', SEED_PASSWORD: 'second-password-BBB' }));
    expect(out.createdUsers).toEqual([]);
    expect(out.passwordSyncedUsers.sort()).toEqual(['david.kim', 'emma.lee', 'james.wilson', 'sarah.chen']);

    expect((await login('second-password-BBB')).status).toBe(200);
    expect((await login('first-password-AAA')).status).toBe(401);
    const refresh = await api().post('/api/auth/refresh').send({ refreshToken: before.body.data.refreshToken });
    expect(refresh.status).toBe(401);
  });

  it('does not re-hash when the password is unchanged', () => {
    const out = summary(runSeed({ NODE_ENV: 'production', SEED_PASSWORD: 'second-password-BBB' }));
    expect(out.passwordSyncedUsers).toEqual([]);
  });

  it('never overwrites existing users with a randomly generated dev password', async () => {
    // Development logs are pretty-printed, so assert on behaviour rather than the log line.
    const out = runSeed({ NODE_ENV: 'development' });
    expect(out).not.toContain('Generated password'); // users exist, so nothing was created or printed
    expect((await login('second-password-BBB')).status).toBe(200);
  });
});
