import { z } from 'zod';
import { idBody, moneySchema, outletIdParamSchema, paginationQuerySchema } from '../../shared/utils/schemas';

export const createMenuItemBodySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  description: z.string().trim().max(500).optional(),
  basePrice: moneySchema,
});

export const assignToOutletBodySchema = z.object({
  outletId: idBody,
  menuItemId: idBody,
  /** Outlet-specific price override; omit to use the master base price. */
  price: moneySchema.optional(),
  isActive: z.boolean().optional().default(true),
});

export const listMenuQuerySchema = paginationQuerySchema;
export { outletIdParamSchema };

export type CreateMenuItemBody = z.infer<typeof createMenuItemBodySchema>;
export type AssignToOutletBody = z.infer<typeof assignToOutletBodySchema>;
