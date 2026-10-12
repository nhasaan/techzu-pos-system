import { sql } from 'drizzle-orm';
import type { DbExecutor } from '.';

export interface RollupLine {
  menuItemId: number;
  quantity: number;
  /** Unit price as a numeric(10,2) string. */
  price: string;
}

/** UTC calendar day of a timestamp, matching the report date filters. */
export const utcDay = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Adds one sale to the daily rollups in a single statement (two data-modifying CTE parts).
 * Called inside the sale transaction, after the outlet row lock is held, so rows for an outlet are
 * only ever updated by one transaction at a time and the rollups commit or roll back with the sale.
 */
export async function recordSaleInRollups(
  exec: DbExecutor,
  sale: { outletId: number; createdAt: Date; totalAmount: string; lines: RollupLine[] },
) {
  const day = utcDay(sale.createdAt);
  const itemValues = sql.join(
    sale.lines.map((l) => sql`(${sale.outletId}::bigint, ${day}::date, ${l.menuItemId}::bigint, ${l.quantity}::int, (${l.quantity}::int * ${l.price}::numeric))`),
    sql`, `,
  );
  await exec.execute(sql`
    WITH daily AS (
      INSERT INTO outlet_daily_sales (outlet_id, day, tx_count, revenue)
      VALUES (${sale.outletId}, ${day}::date, 1, ${sale.totalAmount}::numeric)
      ON CONFLICT (outlet_id, day) DO UPDATE
        SET tx_count = outlet_daily_sales.tx_count + 1,
            revenue = outlet_daily_sales.revenue + EXCLUDED.revenue
    )
    INSERT INTO outlet_item_daily_sales (outlet_id, day, menu_item_id, quantity, revenue)
    VALUES ${itemValues}
    ON CONFLICT (outlet_id, day, menu_item_id) DO UPDATE
      SET quantity = outlet_item_daily_sales.quantity + EXCLUDED.quantity,
          revenue = outlet_item_daily_sales.revenue + EXCLUDED.revenue
  `);
}

/**
 * Recomputes the rollups of the given outlets from the raw tables. Used after bulk loads that bypass
 * the sale flow (seed, imports) and available for reconciliation.
 */
export async function rebuildSalesRollups(exec: DbExecutor, outletIds: number[]) {
  if (!outletIds.length) return;
  const ids = sql.join(outletIds.map((id) => sql`${id}::bigint`), sql`, `);
  await exec.execute(sql`DELETE FROM outlet_daily_sales WHERE outlet_id IN (${ids})`);
  await exec.execute(sql`DELETE FROM outlet_item_daily_sales WHERE outlet_id IN (${ids})`);
  await exec.execute(sql`
    INSERT INTO outlet_daily_sales (outlet_id, day, tx_count, revenue)
    SELECT outlet_id, (created_at AT TIME ZONE 'UTC')::date, count(*), sum(total_amount)
    FROM sales WHERE outlet_id IN (${ids})
    GROUP BY 1, 2
  `);
  await exec.execute(sql`
    INSERT INTO outlet_item_daily_sales (outlet_id, day, menu_item_id, quantity, revenue)
    SELECT s.outlet_id, (s.created_at AT TIME ZONE 'UTC')::date, si.menu_item_id, sum(si.quantity), sum(si.quantity * si.price_at_sale)
    FROM sale_items si JOIN sales s ON s.id = si.sale_id
    WHERE s.outlet_id IN (${ids})
    GROUP BY 1, 2, 3
  `);
}
