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
