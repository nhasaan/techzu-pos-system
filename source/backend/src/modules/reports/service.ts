import { reportsRepository, type DateBounds } from './repository';
import type { DateRangeQuery } from './validation';

const DAY_MS = 86_400_000;

/** Inclusive calendar dates (UTC) -> half-open [from, to) timestamp range. */
function toBounds({ dateFrom, dateTo }: DateRangeQuery): DateBounds {
  return {
    from: dateFrom ? new Date(`${dateFrom}T00:00:00.000Z`) : undefined,
    to: dateTo ? new Date(Date.parse(`${dateTo}T00:00:00.000Z`) + DAY_MS) : undefined,
  };
}

const money = (v: string) => Math.round(Number(v) * 100) / 100;
const echoRange = (q: DateRangeQuery) => ({ ...(q.dateFrom && { dateFrom: q.dateFrom }), ...(q.dateTo && { dateTo: q.dateTo }) });

export async function salesSummaryByOutlet(outletId: number, query: DateRangeQuery) {
  const row = await reportsRepository.summary(outletId, toBounds(query));
  return {
    outletId,
    transactionCount: row.transactionCount,
    totalRevenue: money(row.totalRevenue),
    ...echoRange(query),
  };
}

export async function topItemsByOutlet(outletId: number, query: DateRangeQuery & { limit: number }) {
  const rows = await reportsRepository.topItems(outletId, toBounds(query), query.limit);
  return {
    outletId,
    items: rows.map((r) => ({ ...r, revenue: money(r.revenue) })),
    ...echoRange(query),
  };
}

/** @param outletIds restrict to these outlets (outlet admins); undefined = all outlets (HQ). */
export async function revenueByOutlet(query: DateRangeQuery, outletIds?: number[]) {
  const rows = await reportsRepository.revenueByOutlet(toBounds(query), outletIds);
  const items = rows.map((r) => ({ ...r, totalRevenue: money(r.totalRevenue) }));
  return {
    items,
    totalRevenue: money(String(items.reduce((s, r) => s + r.totalRevenue, 0))),
    ...echoRange(query),
  };
}
