import { z } from 'zod';

export const loginBodySchema = z.object({
  username: z.string().trim().min(1, 'Username is required').max(64),
  password: z.string().min(1, 'Password is required').max(256),
});

export const refreshBodySchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required').max(4096),
});

export type LoginBody = z.infer<typeof loginBodySchema>;
export type RefreshBody = z.infer<typeof refreshBodySchema>;
