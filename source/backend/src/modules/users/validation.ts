import { z } from 'zod';
import { ROLE_OUTLET, USER_ROLES } from '../../shared/db/schema';
import { cursorQuerySchema } from '../../shared/utils/pagination';
import { idBody } from '../../shared/utils/schemas';

export const listUsersQuerySchema = cursorQuerySchema;

export const createUserBodySchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(1, 'Username is required')
      .max(64)
      .regex(/^[A-Za-z0-9._-]+$/, 'Only letters, digits, dot, underscore and dash'),
    password: z.string().min(8, 'Password must be at least 8 characters').max(256),
    role: z.enum(USER_ROLES),
    outletId: idBody.optional(),
  })
  .refine((d) => d.role !== ROLE_OUTLET || d.outletId != null, {
    message: 'Outlet is required when role is outletadmin',
    path: ['outletId'],
  });

export type CreateUserBody = z.infer<typeof createUserBodySchema>;
