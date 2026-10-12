import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';
import * as schema from './schema';

export const pool = new Pool({
  connectionString: config.db.url,
  ssl: config.db.ssl ? { rejectUnauthorized: false } : undefined,
  max: config.db.poolMax,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  // Bound runaway queries and abandoned transactions so one bad request cannot pin connections.
  statement_timeout: config.db.statementTimeoutMs || undefined,
  // A request waiting on a row lock (e.g. a burst of sales at one busy outlet) gives up instead of
  // holding its pool connection for the whole statement timeout.
  lock_timeout: config.db.lockTimeoutMs || undefined,
  idle_in_transaction_session_timeout: 30_000,
  application_name: 'pos-backend',
});

pool.on('error', (err) => logger.error({ err }, 'Idle PostgreSQL client error'));

export const db = drizzle(pool, { schema });

export type Database = typeof db;
/** Either the root db handle or an open transaction; repositories accept both. */
export type DbExecutor = Database | Parameters<Parameters<Database['transaction']>[0]>[0];

export async function pingDb(): Promise<void> {
  await pool.query('SELECT 1');
}
