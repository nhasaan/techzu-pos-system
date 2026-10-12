import { api } from '../lib/api';
import { listQuery, type CursorPage, type ListParams } from '../lib/pagination';

export interface Outlet {
  id: number;
  name: string;
  address: string | null;
  createdAt: string | null;
}

export function listOutlets(params: ListParams = {}) {
  return api<CursorPage<Outlet>>('outlets', { params: listQuery(params) });
}

export function createOutlet(body: { name: string; address?: string }) {
  return api<Outlet>('outlets', { method: 'POST', body: JSON.stringify(body) });
}
