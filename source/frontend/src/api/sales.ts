import { api } from '../lib/api';
import { listQuery, type CursorPage, type ListParams } from '../lib/pagination';

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

export function listSalesByOutlet(outletId: number, params: ListParams = {}) {
  return api<CursorPage<Sale>>(`sales/outlet/${outletId}`, { params: listQuery(params) });
}

export function getSale(saleId: number) {
  return api<SaleWithItems>(`sales/${saleId}`);
}
