// PostgreSQL / node-postgres error classification.
// https://www.postgresql.org/docs/current/errcodes-appendix.html

interface PgLikeError {
  code?: string;
  constraint?: string;
  message?: string;
}

const asPg = (err: unknown): PgLikeError | null => (err && typeof err === 'object' ? (err as PgLikeError) : null);

const CONNECTION_CODES = new Set(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', '57P01', '57P02', '57P03', '53300']);

export function isDbUnavailable(err: unknown): boolean {
  const e = asPg(err);
  if (!e) return false;
  if (e.code && (CONNECTION_CODES.has(e.code) || e.code.startsWith('08'))) return true;
  return typeof e.message === 'string' && /timeout exceeded when trying to connect|Connection terminated/i.test(e.message);
}

export const isQueryTimeout = (err: unknown) => asPg(err)?.code === '57014';

export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  const e = asPg(err);
  return e?.code === '23505' && (constraint == null || e.constraint === constraint);
}

export const isForeignKeyViolation = (err: unknown) => asPg(err)?.code === '23503';
export const isCheckViolation = (err: unknown) => asPg(err)?.code === '23514';
