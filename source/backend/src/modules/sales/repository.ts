import { and, count, desc, eq, inArray, sql } from 'drizzle-orm';
import { db, type DbExecutor } from '../../shared/db';
import { inventory, menuItems, outletMenuItems, outlets, saleItems, sales } from '../../shared/db/schema';

const saleColumns = {
  id: sales.id,
  outletId: sales.outletId,
  receiptNumber: sales.receiptNumber,
  totalAmount: sales.totalAmount,
  createdBy: sales.createdBy,
  createdAt: sales.createdAt,
};

export const salesRepository = {
  /** Effective price (override, else base) for items that are assigned AND active at the outlet. */
  findSellablePrices(exec: DbExecutor, outletId: number, menuItemIds: number[]) {
    return exec
      .select({
        menuItemId: outletMenuItems.menuItemId,
        name: menuItems.name,
        price: sql<string>`COALESCE(${outletMenuItems.price}, ${menuItems.basePrice})`,
      })
      .from(outletMenuItems)
      .innerJoin(menuItems, eq(menuItems.id, outletMenuItems.menuItemId))
      .where(
        and(
          eq(outletMenuItems.outletId, outletId),
          inArray(outletMenuItems.menuItemId, menuItemIds),
          eq(outletMenuItems.isActive, true),
        ),
      );
  },

  /**
   * Row-locks the inventory rows for this sale. Locks are taken in menu_item_id order, so two
   * concurrent sales touching overlapping items always lock in the same order and cannot deadlock.
   */
  lockStock(exec: DbExecutor, outletId: number, menuItemIds: number[]) {
    return exec
      .select({ menuItemId: inventory.menuItemId, stock: inventory.stock })
      .from(inventory)
      .where(and(eq(inventory.outletId, outletId), inArray(inventory.menuItemId, menuItemIds)))
      .orderBy(inventory.menuItemId)
      .for('update');
  },

  /** Deducts all lines in one statement (rows are already locked and checked). */
  async deductStock(exec: DbExecutor, outletId: number, lines: { menuItemId: number; quantity: number }[]) {
    const values = sql.join(
      lines.map((l) => sql`(${l.menuItemId}::bigint, ${l.quantity}::int)`),
      sql`, `,
    );
    await exec.execute(sql`
      UPDATE ${inventory} AS i
      SET stock = i.stock - v.qty, updated_at = now()
      FROM (VALUES ${values}) AS v(menu_item_id, qty)
      WHERE i.outlet_id = ${outletId} AND i.menu_item_id = v.menu_item_id
    `);
  },

  /**
   * Issues the next receipt number for the outlet. The UPDATE takes a row lock on the outlet that
   * is held until commit, so concurrent sales are serialised here and numbers are strictly
   * sequential; a rolled-back sale also rolls back its number, so there are no gaps.
   */
  async nextReceiptNumber(exec: DbExecutor, outletId: number): Promise<number | null> {
    const [row] = await exec
      .update(outlets)
      .set({ receiptSeq: sql`${outlets.receiptSeq} + 1` })
      .where(eq(outlets.id, outletId))
      .returning({ seq: outlets.receiptSeq });
    return row?.seq ?? null;
  },

  async insertSale(
    exec: DbExecutor,
    values: { outletId: number; receiptNumber: string; totalAmount: string; idempotencyKey: string | null; createdBy: number | null },
  ) {
    const [row] = await exec.insert(sales).values(values).returning(saleColumns);
    return row;
  },

  insertSaleItems(exec: DbExecutor, rows: { saleId: number; menuItemId: number; quantity: number; priceAtSale: string }[]) {
    return exec.insert(saleItems).values(rows).returning();
  },

  findByIdempotencyKey(outletId: number, key: string) {
    return db
      .select({ id: sales.id })
      .from(sales)
      .where(and(eq(sales.outletId, outletId), eq(sales.idempotencyKey, key)))
      .then((r) => r[0] ?? null);
  },

  async findById(saleId: number) {
    const [row] = await db.select(saleColumns).from(sales).where(eq(sales.id, saleId));
    return row ?? null;
  },

  findItemsWithNames(saleId: number) {
    return db
      .select({
        id: saleItems.id,
        saleId: saleItems.saleId,
        menuItemId: saleItems.menuItemId,
        quantity: saleItems.quantity,
        priceAtSale: saleItems.priceAtSale,
        itemName: menuItems.name,
      })
      .from(saleItems)
      .innerJoin(menuItems, eq(saleItems.menuItemId, menuItems.id))
      .where(eq(saleItems.saleId, saleId))
      .orderBy(saleItems.id);
  },

  async listByOutlet(outletId: number, limit: number, offset: number) {
    const [rows, [{ total }]] = await Promise.all([
      db
        .select(saleColumns)
        .from(sales)
        .where(eq(sales.outletId, outletId))
        .orderBy(desc(sales.createdAt), desc(sales.id))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(sales).where(eq(sales.outletId, outletId)),
    ]);
    return { rows, total };
  },
};
