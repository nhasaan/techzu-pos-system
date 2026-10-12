import { asc, count, eq } from 'drizzle-orm';
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

  async listItems(limit: number, offset: number) {
    const [rows, [{ total }]] = await Promise.all([
      db.select().from(menuItems).orderBy(asc(menuItems.name), asc(menuItems.id)).limit(limit).offset(offset),
      db.select({ total: count() }).from(menuItems),
    ]);
    return { rows, total };
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

  async listByOutlet(outletId: number, limit: number, offset: number) {
    const [rows, [{ total }]] = await Promise.all([
      db
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
        .where(eq(outletMenuItems.outletId, outletId))
        .orderBy(asc(menuItems.name), asc(menuItems.id))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(outletMenuItems).where(eq(outletMenuItems.outletId, outletId)),
    ]);
    return { rows: rows as OutletMenuRow[], total };
  },
};
