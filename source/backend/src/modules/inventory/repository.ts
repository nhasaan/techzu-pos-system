import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '../../shared/db';
import { inventory, menuItems } from '../../shared/db/schema';

export const inventoryRepository = {
  async upsertStock(values: { outletId: number; menuItemId: number; stock: number }) {
    const [row] = await db
      .insert(inventory)
      .values(values)
      .onConflictDoUpdate({
        target: [inventory.outletId, inventory.menuItemId],
        set: { stock: values.stock, updatedAt: sql`now()` },
      })
      .returning();
    return row;
  },

  /** Sets stock only if it still equals what the client saw; null if it changed (or row missing). */
  async setStockIfUnchanged(values: { outletId: number; menuItemId: number; stock: number; expectedStock: number }) {
    const [row] = await db
      .update(inventory)
      .set({ stock: values.stock, updatedAt: sql`now()` })
      .where(
        and(
          eq(inventory.outletId, values.outletId),
          eq(inventory.menuItemId, values.menuItemId),
          eq(inventory.stock, values.expectedStock),
        ),
      )
      .returning();
    return row ?? null;
  },

  /** Inserts the row only if absent (for expectedStock = 0 on a never-stocked item). */
  async insertStockIfAbsent(values: { outletId: number; menuItemId: number; stock: number }) {
    const [row] = await db.insert(inventory).values(values).onConflictDoNothing().returning();
    return row ?? null;
  },

  /**
   * stock = stock + delta, atomically. Returns null when there is no row and delta is negative.
   * (Not a single INSERT ... ON CONFLICT: PostgreSQL checks CHECK constraints on the proposed insert
   * row first, so a negative delta would always violate stock >= 0 even when the row has stock.)
   * Going below zero violates the CHECK constraint and surfaces as a check violation.
   */
  async adjustStock(values: { outletId: number; menuItemId: number; delta: number }) {
    const [updated] = await db
      .update(inventory)
      .set({ stock: sql`${inventory.stock} + ${values.delta}`, updatedAt: sql`now()` })
      .where(and(eq(inventory.outletId, values.outletId), eq(inventory.menuItemId, values.menuItemId)))
      .returning();
    if (updated || values.delta < 0) return updated ?? null;
    // First stock for this item at this outlet; a concurrent first insert falls through to the update.
    const [inserted] = await db
      .insert(inventory)
      .values({ outletId: values.outletId, menuItemId: values.menuItemId, stock: values.delta })
      .onConflictDoUpdate({
        target: [inventory.outletId, inventory.menuItemId],
        set: { stock: sql`${inventory.stock} + excluded.stock`, updatedAt: sql`now()` },
      })
      .returning();
    return inserted;
  },

  /** Keyset page of an outlet's stock ordered by (item name, menu_item_id); bounded by menu size. */
  listByOutlet(outletId: number, limit: number, after?: readonly [string, number]) {
    return db
      .select({
        id: inventory.id,
        outletId: inventory.outletId,
        menuItemId: inventory.menuItemId,
        stock: inventory.stock,
        updatedAt: inventory.updatedAt,
        itemName: menuItems.name,
      })
      .from(inventory)
      .innerJoin(menuItems, eq(inventory.menuItemId, menuItems.id))
      .where(
        and(
          eq(inventory.outletId, outletId),
          after ? sql`(${menuItems.name}, ${inventory.menuItemId}) > (${after[0]}, ${after[1]})` : undefined,
        ),
      )
      .orderBy(asc(menuItems.name), asc(inventory.menuItemId))
      .limit(limit + 1);
  },
};
