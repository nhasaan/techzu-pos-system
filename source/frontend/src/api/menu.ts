import { api } from '../lib/api';

export interface MenuItem {
  id: number;
  name: string | null;
  description: string | null;
  basePrice: string;
  createdAt: string | null;
}

export interface OutletMenuItem extends MenuItem {
  outletPrice: string | null;
  isActive: boolean | null;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function listMasterMenu(params: { page?: number; limit?: number } = {}) {
  const { page = 1, limit = 20 } = params;
  return api<Paginated<MenuItem>>('menu', { params: { page, limit } });
}

export function createMenuItem(body: { name: string; basePrice: string; description?: string }) {
  return api<MenuItem>('menu', { method: 'POST', body: JSON.stringify(body) });
}

export function assignToOutlet(body: { outletId: number; menuItemId: number; price?: string; isActive?: boolean }) {
  return api<unknown>('menu/assign', { method: 'POST', body: JSON.stringify(body) });
}

export function listMenuByOutlet(outletId: number, params: { page?: number; limit?: number } = {}) {
  const { page = 1, limit = 20 } = params;
  return api<Paginated<OutletMenuItem>>(`menu/outlet/${outletId}`, { params: { page, limit } });
}
