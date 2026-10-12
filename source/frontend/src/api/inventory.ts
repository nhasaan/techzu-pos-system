import { api } from '../lib/api';

export interface InventoryRow {
  id: number;
  outletId: number;
  menuItemId: number;
  stock: number;
  updatedAt: string | null;
  itemName?: string | null;
}

export interface PaginatedInventory {
  items: InventoryRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function listInventoryByOutlet(outletId: number, params: { page?: number; limit?: number } = {}) {
  const { page = 1, limit = 20 } = params;
  return api<PaginatedInventory>(`inventory/outlet/${outletId}`, { params: { page, limit } });
}

export function setStock(body: { outletId: number; menuItemId: number; stock: number }) {
  return api<InventoryRow>('inventory', { method: 'PUT', body: JSON.stringify(body) });
}
