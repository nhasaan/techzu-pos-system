import { z } from 'zod';
import { cursorQuerySchema } from '../../shared/utils/pagination';
import { idBody, outletIdParamSchema } from '../../shared/utils/schemas';

export const setStockBodySchema = z.object({
  outletId: idBody,
  menuItemId: idBody,
  stock: z.number().int().min(0, 'Stock cannot be negative').max(1_000_000),
  /**
   * Optimistic concurrency for stock counts: the stock value the client saw. If sales changed it in
   * the meantime the update is rejected (409) instead of silently erasing those deductions.
   */
  expectedStock: z.number().int().min(0).optional(),
});

export const adjustStockBodySchema = z.object({
  outletId: idBody,
  menuItemId: idBody,
  /** Relative change (deliveries +, waste/corrections -), applied atomically. */
  delta: z
    .number()
    .int()
    .min(-1_000_000)
    .max(1_000_000)
    .refine((d) => d !== 0, 'Delta must not be 0'),
});

export const listInventoryQuerySchema = cursorQuerySchema;
export { outletIdParamSchema };

export type SetStockBody = z.infer<typeof setStockBodySchema>;
export type AdjustStockBody = z.infer<typeof adjustStockBodySchema>;
