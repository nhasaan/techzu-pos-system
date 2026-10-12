import { z } from 'zod';
import { cursorQuerySchema } from '../../shared/utils/pagination';
import { idBody, moneySchema, optionalText, outletIdParamSchema } from '../../shared/utils/schemas';

export const createMenuItemBodySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  description: optionalText(500),
  basePrice: moneySchema,
});

export const assignToOutletBodySchema = z.object({
  outletId: idBody,
  menuItemId: idBody,
  /** Outlet-specific price override; omit to use the master base price. */
  price: moneySchema.optional(),
  isActive: z.boolean().optional().default(true),
});

export const listMenuQuerySchema = cursorQuerySchema;
export { outletIdParamSchema };

export type CreateMenuItemBody = z.infer<typeof createMenuItemBodySchema>;
export type AssignToOutletBody = z.infer<typeof assignToOutletBodySchema>;
