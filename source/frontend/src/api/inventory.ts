import { api } from '../lib/api';
import { listQuery, type CursorPage, type ListParams } from '../lib/pagination';

export interface InventoryRow {
  id: number;
  outletId: number;
  menuItemId: number;
  stock: number;
  updatedAt: string | null;
  itemName?: string | null;
}

export function listInventoryByOutlet(outletId: number, params: ListParams = {}) {
  return api<CursorPage<InventoryRow>>(`inventory/outlet/${outletId}`, { params: listQuery(params) });
}

export function setStock(body: { outletId: number; menuItemId: number; stock: number }) {
  return api<InventoryRow>('inventory', { method: 'PUT', body: JSON.stringify(body) });
}
