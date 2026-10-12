import { z } from 'zod';
import { paginationQuerySchema } from '../../shared/utils/schemas';

export const createOutletBodySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  address: z.string().trim().max(500).optional(),
});

export const listOutletsQuerySchema = paginationQuerySchema;

export type CreateOutletBody = z.infer<typeof createOutletBodySchema>;
