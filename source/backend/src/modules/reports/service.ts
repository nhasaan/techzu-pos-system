import { reportsRepository, type DayRange } from './repository';
import type { DateRangeQuery } from './validation';

const toRange = ({ dateFrom, dateTo }: DateRangeQuery): DayRange => ({ from: dateFrom, to: dateTo });

const money = (v: string) => Math.round(Number(v) * 100) / 100;
const echoRange = (q: DateRangeQuery) => ({ ...(q.dateFrom && { dateFrom: q.dateFrom }), ...(q.dateTo && { dateTo: q.dateTo }) });

export async function salesSummaryByOutlet(outletId: number, query: DateRangeQuery) {
  const row = await reportsRepository.summary(outletId, toRange(query));
  return {
    outletId,
    transactionCount: row.transactionCount,
    totalRevenue: money(row.totalRevenue),
    ...echoRange(query),
  };
}

export async function topItemsByOutlet(outletId: number, query: DateRangeQuery & { limit: number }) {
  const rows = await reportsRepository.topItems(outletId, toRange(query), query.limit);
  return {
    outletId,
    items: rows.map((r) => ({ ...r, revenue: money(r.revenue) })),
    ...echoRange(query),
  };
}

/** @param outletIds restrict to these outlets (outlet admins); undefined = all outlets (HQ). */
export async function revenueByOutlet(query: DateRangeQuery, outletIds?: number[]) {
  const rows = await reportsRepository.revenueByOutlet(toRange(query), outletIds);
  const items = rows.map((r) => ({ ...r, totalRevenue: money(r.totalRevenue) }));
  // Sum in integer cents: adding rounded floats can drift (0.1 + 0.2 !== 0.3).
  const totalCents = rows.reduce((sum, r) => sum + Math.round(Number(r.totalRevenue) * 100), 0);
  return {
    items,
    totalRevenue: totalCents / 100,
    ...echoRange(query),
  };
}
