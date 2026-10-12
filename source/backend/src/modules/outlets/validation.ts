import { z } from 'zod';
import { cursorQuerySchema } from '../../shared/utils/pagination';
import { optionalText } from '../../shared/utils/schemas';

export const createOutletBodySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  address: optionalText(500),
});

export const listOutletsQuerySchema = cursorQuerySchema;

export type CreateOutletBody = z.infer<typeof createOutletBodySchema>;
