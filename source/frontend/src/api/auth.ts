import { api, ApiError } from '../lib/api';

export interface LoginPayload {
  accessToken: string;
  refreshToken: string;
}

export async function login(username: string, password: string): Promise<LoginPayload> {
  return api<LoginPayload>('auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function refresh(refreshToken: string): Promise<LoginPayload> {
  return api<LoginPayload>('auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
}

export async function logout(): Promise<void> {
  await api<unknown>('auth/logout', { method: 'POST' });
}

export { ApiError };
