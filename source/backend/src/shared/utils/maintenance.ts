import { pool } from '../db';
import { logger } from './logger';

const CLEANUP_LOCK_KEY = 482_190_003;
const BATCH = 5_000;
const INTERVAL_MS = 60 * 60 * 1000;

/**
 * Deletes refresh sessions that expired more than a day ago, in batches (short transactions, no long
 * locks). Without this the tokens table grows forever: every refresh inserts a row, and per-user
 * cleanup on login never runs for terminals that stay signed in. Only one instance does the work at a
 * time (try-advisory-lock); the others skip that run.
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{ locked: boolean }>('SELECT pg_try_advisory_lock($1) AS locked', [CLEANUP_LOCK_KEY]);
    if (!rows[0].locked) return 0;
    try {
      let total = 0;
      for (;;) {
        const res = await client.query(
          `DELETE FROM tokens WHERE id IN (
             SELECT id FROM tokens WHERE expires_at < now() - interval '1 day' LIMIT $1
           )`,
          [BATCH],
        );
        total += res.rowCount ?? 0;
        if ((res.rowCount ?? 0) < BATCH) break;
      }
      if (total) logger.info({ deleted: total }, 'Expired sessions cleaned up');
      return total;
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [CLEANUP_LOCK_KEY]);
    }
  } finally {
    client.release();
  }
}

let timer: NodeJS.Timeout | null = null;

export function startMaintenance() {
  const run = () => cleanupExpiredSessions().catch((err) => logger.warn({ err }, 'Session cleanup failed'));
  setTimeout(run, 60_000).unref();
  timer = setInterval(run, INTERVAL_MS);
  timer.unref();
}

export function stopMaintenance() {
  if (timer) clearInterval(timer);
  timer = null;
}
