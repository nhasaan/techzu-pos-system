import { z } from 'zod';
import { isoDateSchema, outletIdParamSchema } from '../../shared/utils/schemas';

const dateRange = z.object({
  dateFrom: isoDateSchema.optional(),
  dateTo: isoDateSchema.optional(),
});

const dateOrderOk = (d: { dateFrom?: string; dateTo?: string }) => !d.dateFrom || !d.dateTo || d.dateFrom <= d.dateTo;
const dateOrderMsg = { message: 'dateFrom must be before or equal to dateTo', path: ['dateFrom'] };

export const salesSummaryQuerySchema = dateRange.refine(dateOrderOk, dateOrderMsg);

export const topItemsQuerySchema = dateRange
  .extend({ limit: z.coerce.number().int().min(1).max(20).optional().default(5) })
  .refine(dateOrderOk, dateOrderMsg);

export { outletIdParamSchema };

export type DateRangeQuery = z.infer<typeof salesSummaryQuerySchema>;
export type TopItemsQuery = z.infer<typeof topItemsQuerySchema>;
