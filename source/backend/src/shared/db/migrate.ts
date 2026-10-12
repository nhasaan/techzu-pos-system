import path from 'path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from '.';
import { logger } from '../utils/logger';

// Resolves to backend/drizzle from both src/shared/db (tsx) and dist/shared/db (compiled).
const migrationsFolder = path.resolve(__dirname, '../../../drizzle');

async function run() {
  logger.info({ migrationsFolder }, 'Running migrations');
  await migrate(db, { migrationsFolder });
  logger.info('Migrations complete');
}

run()
  .catch((err) => {
    logger.error({ err }, 'Migration failed');
    process.exitCode = 1;
  })
  .finally(() => pool.end());
