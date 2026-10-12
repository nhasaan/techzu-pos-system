import path from 'path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { pool } from '.';
import { logger } from '../utils/logger';

// Resolves to backend/drizzle from both src/shared/db (tsx) and dist/shared/db (compiled).
const migrationsFolder = path.resolve(__dirname, '../../../drizzle');

// Arbitrary app-wide key. Several instances may boot at once and all try to migrate; the
// session-level advisory lock makes them run one after another (later ones find nothing to do).
const MIGRATION_LOCK_KEY = 482_190_001;

async function run() {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
    logger.info({ migrationsFolder }, 'Running migrations');
    await migrate(drizzle(client), { migrationsFolder });
    logger.info('Migrations complete');
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]).catch(() => undefined);
    client.release();
  }
}

run()
  .catch((err) => {
    logger.error({ err }, 'Migration failed');
    process.exitCode = 1;
  })
  .finally(() => pool.end());
