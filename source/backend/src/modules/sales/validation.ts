import { z } from 'zod';
import { idBody, outletIdParamSchema, paginationQuerySchema, saleIdParamSchema } from '../../shared/utils/schemas';

const saleItemSchema = z.object({
  menuItemId: idBody,
  quantity: z.number().int().min(1, 'Quantity must be at least 1').max(1000),
});

export const createSaleBodySchema = z.object({
  /** Required for HQ/superadmin; ignored for outlet admins (their own outlet is used). */
  outletId: idBody.optional(),
  items: z.array(saleItemSchema).min(1, 'At least one item required').max(100),
});

export const idempotencyKeySchema = z
  .string()
  .regex(/^[A-Za-z0-9._:-]{1,100}$/, 'Idempotency-Key must be 1-100 chars of [A-Za-z0-9._:-]')
  .optional();

export const listSalesQuerySchema = paginationQuerySchema;
export { outletIdParamSchema, saleIdParamSchema };

export type CreateSaleBody = z.infer<typeof createSaleBodySchema>;
export type SaleItemInput = z.infer<typeof saleItemSchema>;
