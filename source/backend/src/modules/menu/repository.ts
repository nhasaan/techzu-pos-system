import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '../../shared/db';
import { menuItems, outletMenuItems } from '../../shared/db/schema';

export type MenuItemRow = typeof menuItems.$inferSelect;

export interface OutletMenuRow {
  id: number;
  name: string;
  description: string | null;
  basePrice: string;
  createdAt: Date;
  outletPrice: string | null;
  isActive: boolean;
}

export const menuRepository = {
  async createItem(values: { name: string; description: string | null; basePrice: string }) {
    const [row] = await db.insert(menuItems).values(values).returning();
    return row;
  },

  findItemById(id: number) {
    return db.query.menuItems.findFirst({ where: eq(menuItems.id, id) });
  },

  /** Keyset page of the master menu ordered by (name, id); served by menu_items_name_id_idx. */
  listItems(limit: number, after?: readonly [string, number]) {
    return db
      .select()
      .from(menuItems)
      .where(after ? sql`(${menuItems.name}, ${menuItems.id}) > (${after[0]}, ${after[1]})` : undefined)
      .orderBy(asc(menuItems.name), asc(menuItems.id))
      .limit(limit + 1);
  },

  /** Insert or update the assignment (outlet, menu item) in one statement. */
  async upsertAssignment(values: { outletId: number; menuItemId: number; price: string | null; isActive: boolean }) {
    const [row] = await db
      .insert(outletMenuItems)
      .values(values)
      .onConflictDoUpdate({
        target: [outletMenuItems.outletId, outletMenuItems.menuItemId],
        set: { price: values.price, isActive: values.isActive },
      })
      .returning();
    return row;
  },

  /**
   * Keyset page of an outlet's assigned items ordered by (name, id). The outlet filter uses the
   * (outlet_id, menu_item_id) unique index; the sort is over that outlet's items only, which is
   * bounded by the menu size (hundreds), not by table size.
   */
  async listByOutlet(outletId: number, limit: number, after?: readonly [string, number]) {
    const rows = await db
      .select({
        id: menuItems.id,
        name: menuItems.name,
        description: menuItems.description,
        basePrice: menuItems.basePrice,
        createdAt: menuItems.createdAt,
        outletPrice: outletMenuItems.price,
        isActive: outletMenuItems.isActive,
      })
      .from(outletMenuItems)
      .innerJoin(menuItems, eq(outletMenuItems.menuItemId, menuItems.id))
      .where(
        and(
          eq(outletMenuItems.outletId, outletId),
          after ? sql`(${menuItems.name}, ${menuItems.id}) > (${after[0]}, ${after[1]})` : undefined,
        ),
      )
      .orderBy(asc(menuItems.name), asc(menuItems.id))
      .limit(limit + 1);
    return rows as OutletMenuRow[];
  },
};
