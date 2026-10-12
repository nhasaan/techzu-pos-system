import { and, desc, eq, gte, inArray, lte, sql, type SQL } from 'drizzle-orm';
import { db } from '../../shared/db';
import { menuItems, outletDailySales, outletItemDailySales, outlets } from '../../shared/db/schema';

/** Inclusive UTC calendar days (YYYY-MM-DD). */
export interface DayRange {
  from?: string;
  to?: string;
}

function dayFilters(day: typeof outletDailySales.day | typeof outletItemDailySales.day, range: DayRange): SQL[] {
  const filters: SQL[] = [];
  if (range.from) filters.push(gte(day, range.from));
  if (range.to) filters.push(lte(day, range.to));
  return filters;
}

// Reports read the daily rollups (see shared/db/rollups.ts), never the raw sales tables: cost depends
// on the number of days in the range, not on how many sales exist. Primary keys (outlet_id, day[, item])
// serve every filter below.
export const reportsRepository = {
  async summary(outletId: number, range: DayRange) {
    const [row] = await db
      .select({
        transactionCount: sql<number>`COALESCE(SUM(${outletDailySales.txCount}), 0)::int`,
        totalRevenue: sql<string>`COALESCE(SUM(${outletDailySales.revenue}), 0)::text`,
      })
      .from(outletDailySales)
      .where(and(eq(outletDailySales.outletId, outletId), ...dayFilters(outletDailySales.day, range)));
    return row;
  },

  topItems(outletId: number, range: DayRange, limit: number) {
    const quantitySold = sql<number>`SUM(${outletItemDailySales.quantity})::int`;
    const revenue = sql`SUM(${outletItemDailySales.revenue})`;
    return db
      .select({
        menuItemId: outletItemDailySales.menuItemId,
        name: menuItems.name,
        quantitySold,
        revenue: sql<string>`${revenue}::text`,
      })
      .from(outletItemDailySales)
      .innerJoin(menuItems, eq(menuItems.id, outletItemDailySales.menuItemId))
      .where(and(eq(outletItemDailySales.outletId, outletId), ...dayFilters(outletItemDailySales.day, range)))
      .groupBy(outletItemDailySales.menuItemId, menuItems.name)
      .orderBy(desc(quantitySold), desc(revenue), outletItemDailySales.menuItemId)
      .limit(limit);
  },

  /** Revenue per outlet; outlets without sales in the range are included with zero. */
  revenueByOutlet(range: DayRange, outletIds?: number[]) {
    const revenue = sql`COALESCE(SUM(${outletDailySales.revenue}), 0)`;
    return db
      .select({
        outletId: outlets.id,
        outletName: outlets.name,
        transactionCount: sql<number>`COALESCE(SUM(${outletDailySales.txCount}), 0)::int`,
        totalRevenue: sql<string>`${revenue}::text`,
      })
      .from(outlets)
      .leftJoin(outletDailySales, and(eq(outletDailySales.outletId, outlets.id), ...dayFilters(outletDailySales.day, range)))
      .where(outletIds ? inArray(outlets.id, outletIds) : undefined)
      .groupBy(outlets.id, outlets.name)
      .orderBy(desc(revenue), outlets.name);
  },
};
