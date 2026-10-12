import { z } from 'zod';
import { cursorQuerySchema } from '../../shared/utils/pagination';
import { idBody, outletIdParamSchema } from '../../shared/utils/schemas';

export const setStockBodySchema = z.object({
  outletId: idBody,
  menuItemId: idBody,
  stock: z.number().int().min(0, 'Stock cannot be negative').max(1_000_000),
});

export const listInventoryQuerySchema = cursorQuerySchema;
export { outletIdParamSchema };

export type SetStockBody = z.infer<typeof setStockBodySchema>;
