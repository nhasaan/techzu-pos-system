// PostgreSQL / node-postgres error classification.
// https://www.postgresql.org/docs/current/errcodes-appendix.html

interface PgLikeError {
  code?: string;
  constraint?: string;
  message?: string;
}

/**
 * The PostgreSQL error behind `err`. Drizzle (>= 0.44) wraps driver errors in DrizzleQueryError with
 * the original node-postgres error as `cause`, so walk the cause chain to the one carrying a SQLSTATE.
 */
function asPg(err: unknown): PgLikeError | null {
  let current: unknown = err;
  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth++) {
    const e = current as PgLikeError & { cause?: unknown };
    if (typeof e.code === 'string') return e;
    current = e.cause;
  }
  return err && typeof err === 'object' ? (err as PgLikeError) : null;
}

const CONNECTION_CODES = new Set(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', '57P01', '57P02', '57P03', '53300']);

export function isDbUnavailable(err: unknown): boolean {
  const e = asPg(err);
  if (!e) return false;
  if (e.code && (CONNECTION_CODES.has(e.code) || e.code.startsWith('08'))) return true;
  return typeof e.message === 'string' && /timeout exceeded when trying to connect|Connection terminated/i.test(e.message);
}

export const isQueryTimeout = (err: unknown) => asPg(err)?.code === '57014';
export const isLockTimeout = (err: unknown) => asPg(err)?.code === '55P03';

export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  const e = asPg(err);
  return e?.code === '23505' && (constraint == null || e.constraint === constraint);
}

export const isForeignKeyViolation = (err: unknown) => asPg(err)?.code === '23503';
export const isCheckViolation = (err: unknown) => asPg(err)?.code === '23514';

/** Name of the violated constraint, if any (through Drizzle's error wrapper). */
export const pgConstraint = (err: unknown) => asPg(err)?.constraint;
