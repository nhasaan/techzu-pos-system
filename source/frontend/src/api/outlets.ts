import { api } from '../lib/api';

export interface Outlet {
  id: number;
  name: string;
  address: string | null;
  createdAt: string | null;
}

export interface PaginatedOutlets {
  items: Outlet[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function listOutlets(params: { page?: number; limit?: number } = {}) {
  const { page = 1, limit = 20 } = params;
  return api<PaginatedOutlets>('outlets', { params: { page, limit } });
}

export function createOutlet(body: { name: string; address?: string }) {
  return api<Outlet>('outlets', { method: 'POST', body: JSON.stringify(body) });
}
