import { z } from 'zod';

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function paginate<T>(items: T[], total: number, page: number, limit: number): Paginated<T> {
  return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

const MAX_ID = Number.MAX_SAFE_INTEGER;

/** Positive integer id from a URL segment, e.g. /outlets/:outletId */
export const idParam = z
  .string()
  .regex(/^\d{1,16}$/, 'Must be a positive integer')
  .transform(Number)
  .refine((n) => n > 0 && n <= MAX_ID, 'Must be a positive integer');

export const idBody = z.number().int().positive().max(MAX_ID);

export const outletIdParamSchema = z.object({ outletId: idParam });
export const saleIdParamSchema = z.object({ saleId: idParam });

/** Money as a decimal string with up to 2 places (numbers are accepted and normalised). */
export const moneySchema = z.union([
  z.string().trim().regex(/^\d{1,8}(\.\d{1,2})?$/, 'Invalid decimal (e.g. 10 or 10.50)'),
  z.number().nonnegative().max(99_999_999.99).transform((n) => n.toFixed(2)),
]);

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').refine(
  (s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)),
  'Invalid date',
);
