import { Router } from 'express';
import { pingDb } from '../../shared/db';
import { isRedisReady } from '../../shared/utils/redis';
import { success, fail } from '../../shared/utils/response';

export const healthRouter = Router();

/** Liveness: the process is up. Cheap, no dependencies — safe for frequent LB probes. */
healthRouter.get('/health', (_req, res) => {
  res.json(success('ok', { ok: true }));
});

/** Readiness: dependencies reachable. Use for deploy gates / k8s readinessProbe. */
healthRouter.get('/health/ready', async (_req, res) => {
  const checks: Record<string, 'up' | 'down'> = {};
  try {
    await pingDb();
    checks.database = 'up';
  } catch {
    checks.database = 'down';
  }
  const ok = checks.database === 'up';
  // Redis is optional (the API degrades gracefully without it), so it is reported but not gating.
  checks.redis = isRedisReady() ? 'up' : 'down';
  res.status(ok ? 200 : 503).json(ok ? success('ready', checks) : fail('not ready', checks));
});
