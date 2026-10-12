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

/** Set an exact count. `expectedStock` makes the server reject the write (409) if stock changed meanwhile. */
export function setStock(body: { outletId: number; menuItemId: number; stock: number; expectedStock?: number }) {
  return api<InventoryRow>('inventory', { method: 'PUT', body: JSON.stringify(body) });
}

/** Add (delivery) or remove (waste) stock atomically; safe while sales are running. */
export function adjustStock(body: { outletId: number; menuItemId: number; delta: number }) {
  return api<InventoryRow>('inventory/adjust', { method: 'POST', body: JSON.stringify(body) });
}
