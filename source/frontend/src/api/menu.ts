import { api } from '../lib/api';
import { listQuery, type CursorPage, type ListParams } from '../lib/pagination';

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

export function listMasterMenu(params: ListParams = {}) {
  return api<CursorPage<MenuItem>>('menu', { params: listQuery(params) });
}

export function createMenuItem(body: { name: string; basePrice: string; description?: string }) {
  return api<MenuItem>('menu', { method: 'POST', body: JSON.stringify(body) });
}

export function assignToOutlet(body: { outletId: number; menuItemId: number; price?: string; isActive?: boolean }) {
  return api<unknown>('menu/assign', { method: 'POST', body: JSON.stringify(body) });
}

export function listMenuByOutlet(outletId: number, params: ListParams = {}) {
  return api<CursorPage<OutletMenuItem>>(`menu/outlet/${outletId}`, { params: listQuery(params) });
}
