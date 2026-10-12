import { z } from 'zod';

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

// Date.parse happily rolls 2026-02-31 over to March 3, so require an exact round trip.
const isRealCalendarDate = (s: string) => {
  const t = Date.parse(`${s}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === s;
};

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
  .refine(isRealCalendarDate, 'Invalid calendar date');

/** Optional free text: trimmed, and blank input becomes undefined (stored as NULL, not ''). */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));
