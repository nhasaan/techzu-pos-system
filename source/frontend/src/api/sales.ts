import { api } from '../lib/api';

export interface Sale {
  id: number;
  outletId: number;
  receiptNumber: string;
  totalAmount: string;
  createdAt: string | null;
}

export interface SaleItem {
  id: number;
  saleId: number;
  menuItemId: number;
  quantity: number;
  priceAtSale: string;
  itemName?: string | null;
}

export interface SaleWithItems extends Sale {
  items: SaleItem[];
}

export interface PaginatedSales {
  items: Sale[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateSalePayload {
  outletId?: number;
  items: { menuItemId: number; quantity: number }[];
}

export interface CreateSaleResult {
  sale: Sale;
  items: SaleItem[];
  receiptNumber: string;
  totalAmount: string;
}

/**
 * @param idempotencyKey stable per checkout attempt: retries (double click, network timeout)
 * return the original sale instead of charging twice.
 */
export function createSale(body: CreateSalePayload, idempotencyKey?: string) {
  return api<CreateSaleResult>('sales', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
  });
}

export function listSalesByOutlet(outletId: number, params: { page?: number; limit?: number } = {}) {
  const { page = 1, limit = 20 } = params;
  return api<PaginatedSales>(`sales/outlet/${outletId}`, { params: { page, limit } });
}

export function getSale(saleId: number) {
  return api<SaleWithItems>(`sales/${saleId}`);
}
