import { api } from '../lib/api';

export interface User {
  id: number;
  username: string;
  role: string;
  outletId: number | null;
  createdAt: string | null;
}

export interface PaginatedUsers {
  items: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function listUsers(params: { page?: number; limit?: number } = {}) {
  const { page = 1, limit = 20 } = params;
  return api<PaginatedUsers>('users', { params: { page, limit } });
}

export function createUser(body: { username: string; password: string; role: string; outletId?: number }) {
  return api<User>('users', { method: 'POST', body: JSON.stringify(body) });
}
