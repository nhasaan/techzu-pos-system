import { asc, count, eq, sql } from 'drizzle-orm';
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

  async listByOutlet(outletId: number, limit: number, offset: number) {
    const [rows, [{ total }]] = await Promise.all([
      db
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
        .where(eq(inventory.outletId, outletId))
        .orderBy(asc(menuItems.name), asc(inventory.menuItemId))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(inventory).where(eq(inventory.outletId, outletId)),
    ]);
    return { rows, total };
  },
};
