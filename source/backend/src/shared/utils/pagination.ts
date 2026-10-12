import { z, type ZodTypeAny } from 'zod';
import { ValidationError } from './errors';

/**
 * Keyset (cursor) pagination.
 *
 * OFFSET pagination makes PostgreSQL read and discard every row before the requested page and needs
 * a COUNT(*) for page numbers, so cost grows with table size and page depth; rows inserted while a
 * client pages through also shift pages (duplicates / gaps). Keyset pagination instead continues
 * strictly after the last row's sort key using an index: every page costs the same, and results stay
 * stable under concurrent inserts.
 *
 * The cursor is the last row's sort key, JSON-encoded and base64url'd. It is opaque to clients and
 * always re-validated (types and shape) before reaching SQL, where it is passed as bound parameters.
 */

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const cursorQuerySchema = z.object({
  cursor: z
    .string()
    .max(512)
    .regex(/^[A-Za-z0-9_-]+$/, 'Invalid cursor')
    .optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional().default(DEFAULT_PAGE_SIZE),
});
export type CursorQuery = z.infer<typeof cursorQuerySchema>;

export interface CursorPage<T> {
  items: T[];
  /** Pass back as ?cursor= to get the next page; null on the last page. */
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
}

type CursorKey = readonly (string | number)[];

export const encodeCursor = (key: CursorKey) => Buffer.from(JSON.stringify(key), 'utf8').toString('base64url');

/** Decodes and validates a cursor against the endpoint's key shape. Invalid cursors -> 422. */
export function decodeCursor<S extends ZodTypeAny>(cursor: string | undefined, keySchema: S): z.infer<S> | undefined {
  if (!cursor) return undefined;
  try {
    const parsed = keySchema.safeParse(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')));
    if (parsed.success) return parsed.data;
  } catch {
    // fall through
  }
  throw new ValidationError('Invalid cursor', { cursor: 'Invalid or malformed cursor' });
}

/**
 * Builds a page from rows fetched with `LIMIT limit + 1`: the extra row only tells us whether a
 * next page exists (no COUNT(*) needed). `keyOf` returns the sort key of a row.
 */
export function toCursorPage<Row, Out = Row>(
  rows: Row[],
  limit: number,
  keyOf: (row: Row) => CursorKey,
  map: (row: Row) => Out = (row) => row as unknown as Out,
): CursorPage<Out> {
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  return {
    items: pageRows.map(map),
    nextCursor: hasMore ? encodeCursor(keyOf(pageRows[pageRows.length - 1])) : null,
    hasMore,
    limit,
  };
}

// Cursor key shapes shared by modules.
export const nameIdKey = z.tuple([z.string().max(500), z.number().int().positive()]);
export const textKey = z.tuple([z.string().max(500)]);
/** Timestamps travel as PostgreSQL's own text form to keep microsecond precision (JS Date has ms). */
export const timestampIdKey = z.tuple([
  z.string().regex(/^\d{4}-\d{2}-\d{2}[ T][\d:.]+([+-]\d{2}(:?\d{2})?|Z)$/),
  z.number().int().positive(),
]);
