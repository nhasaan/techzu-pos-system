import { api } from '../lib/api';

export interface DateRange {
  dateFrom?: string;
  dateTo?: string;
}

export interface SalesSummary extends DateRange {
  outletId: number;
  transactionCount: number;
  totalRevenue: number;
}

export interface TopItem {
  menuItemId: number;
  name: string;
  quantitySold: number;
  revenue: number;
}

export interface TopItemsReport extends DateRange {
  outletId: number;
  items: TopItem[];
}

export interface OutletRevenue {
  outletId: number;
  outletName: string;
  transactionCount: number;
  totalRevenue: number;
}

export interface RevenueByOutletReport extends DateRange {
  items: OutletRevenue[];
  totalRevenue: number;
}

function rangeParams(params: DateRange = {}): Record<string, string> {
  const search: Record<string, string> = {};
  if (params.dateFrom) search.dateFrom = params.dateFrom;
  if (params.dateTo) search.dateTo = params.dateTo;
  return search;
}

export function getSalesSummary(outletId: number, params: DateRange = {}) {
  return api<SalesSummary>(`reports/outlet/${outletId}/summary`, { params: rangeParams(params) });
}

export function getTopItems(outletId: number, params: DateRange & { limit?: number } = {}) {
  return api<TopItemsReport>(`reports/outlet/${outletId}/top-items`, {
    params: { ...rangeParams(params), limit: params.limit ?? 5 },
  });
}

export function getRevenueByOutlet(params: DateRange = {}) {
  return api<RevenueByOutletReport>('reports/revenue-by-outlet', { params: rangeParams(params) });
}
