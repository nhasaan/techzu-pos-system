import { and, count, desc, eq, gte, inArray, lt, sql, type SQL } from 'drizzle-orm';
import { db } from '../../shared/db';
import { menuItems, outlets, saleItems, sales } from '../../shared/db/schema';

export interface DateBounds {
  from?: Date;
  /** Exclusive upper bound. */
  to?: Date;
}

function saleFilters(bounds: DateBounds, outletIds?: number[]): SQL[] {
  const filters: SQL[] = [];
  if (outletIds) filters.push(inArray(sales.outletId, outletIds));
  if (bounds.from) filters.push(gte(sales.createdAt, bounds.from));
  if (bounds.to) filters.push(lt(sales.createdAt, bounds.to));
  return filters;
}

// All aggregation happens in PostgreSQL; only result rows cross the wire.
// The (outlet_id, created_at) index on sales serves every filter below.
export const reportsRepository = {
  async summary(outletId: number, bounds: DateBounds) {
    const [row] = await db
      .select({
        transactionCount: count(),
        totalRevenue: sql<string>`COALESCE(SUM(${sales.totalAmount}), 0)::text`,
      })
      .from(sales)
      .where(and(...saleFilters(bounds, [outletId])));
    return row;
  },

  topItems(outletId: number, bounds: DateBounds, limit: number) {
    const quantitySold = sql<number>`SUM(${saleItems.quantity})::int`;
    return db
      .select({
        menuItemId: saleItems.menuItemId,
        name: menuItems.name,
        quantitySold,
        revenue: sql<string>`SUM(${saleItems.quantity} * ${saleItems.priceAtSale})::text`,
      })
      .from(saleItems)
      .innerJoin(sales, eq(sales.id, saleItems.saleId))
      .innerJoin(menuItems, eq(menuItems.id, saleItems.menuItemId))
      .where(and(...saleFilters(bounds, [outletId])))
      .groupBy(saleItems.menuItemId, menuItems.name)
      .orderBy(desc(quantitySold), desc(sql`SUM(${saleItems.quantity} * ${saleItems.priceAtSale})`), saleItems.menuItemId)
      .limit(limit);
  },

  /** Revenue per outlet; outlets without sales in the range are included with zero. */
  revenueByOutlet(bounds: DateBounds, outletIds?: number[]) {
    const joinOn = and(eq(sales.outletId, outlets.id), ...saleFilters(bounds));
    return db
      .select({
        outletId: outlets.id,
        outletName: outlets.name,
        transactionCount: sql<number>`COUNT(${sales.id})::int`,
        totalRevenue: sql<string>`COALESCE(SUM(${sales.totalAmount}), 0)::text`,
      })
      .from(outlets)
      .leftJoin(sales, joinOn)
      .where(outletIds ? inArray(outlets.id, outletIds) : undefined)
      .groupBy(outlets.id, outlets.name)
      .orderBy(desc(sql`COALESCE(SUM(${sales.totalAmount}), 0)`), outlets.name);
  },
};
