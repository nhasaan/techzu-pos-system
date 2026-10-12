import { api } from '../lib/api';
import { listQuery, type CursorPage, type ListParams } from '../lib/pagination';

export interface User {
  id: number;
  username: string;
  role: string;
  outletId: number | null;
  createdAt: string | null;
}

export function listUsers(params: ListParams = {}) {
  return api<CursorPage<User>>('users', { params: listQuery(params) });
}

export function createUser(body: { username: string; password: string; role: string; outletId?: number }) {
  return api<User>('users', { method: 'POST', body: JSON.stringify(body) });
}
