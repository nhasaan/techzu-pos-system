import { count, eq, inArray, sql } from 'drizzle-orm';
import { db, pool } from '../shared/db';
import {
  inventory,
  menuItems,
  outletMenuItems,
  outlets,
  ROLE_HQ,
  ROLE_OUTLET,
  ROLE_SUPERADMIN,
  saleItems,
  sales,
  users,
} from '../shared/db/schema';
import { logger } from '../shared/utils/logger';
import { hashPassword } from '../shared/utils/password';
import { rebuildSalesRollups } from '../shared/db/rollups';

// `||`, not `??`: an env var left blank (e.g. an unfilled Render prompt) must not become an empty password.
const DEFAULT_PASSWORD = process.env.SEED_PASSWORD?.trim() || 'REDACTED';

const SEED_OUTLETS = [
  { name: 'Main Outlet', address: '123 Main St' },
  { name: 'Downtown Outlet', address: '456 Downtown Ave' },
];

const SEED_MENU_ITEMS = [
  { name: 'Espresso', description: 'Single shot', basePrice: '2.50' },
  { name: 'Latte', description: 'Espresso with steamed milk', basePrice: '4.00' },
  { name: 'Cappuccino', description: 'Espresso with foam', basePrice: '4.25' },
  { name: 'Americano', description: 'Espresso with hot water', basePrice: '3.00' },
  { name: 'Croissant', description: 'Butter pastry', basePrice: '3.50' },
  { name: 'Sandwich', description: 'Club sandwich', basePrice: '8.00' },
  { name: 'Muffin', description: 'Blueberry muffin', basePrice: '3.00' },
  { name: 'Orange Juice', description: 'Fresh squeezed', basePrice: '4.50' },
  { name: 'Flat White', description: 'Double shot with microfoam', basePrice: '4.50' },
  { name: 'Cold Brew', description: 'Iced coffee', basePrice: '4.75' },
  { name: 'Hot Chocolate', description: 'Cocoa drink', basePrice: '3.75' },
  { name: 'Tea', description: 'Earl Grey or Green', basePrice: '2.75' },
  { name: 'Bagel', description: 'Plain or toasted', basePrice: '3.25' },
  { name: 'Salad', description: 'House salad', basePrice: '7.50' },
  { name: 'Soup', description: 'Soup of the day', basePrice: '5.00' },
  { name: 'Cookie', description: 'Chocolate chip', basePrice: '2.25' },
  { name: 'Brownie', description: 'Chocolate brownie', basePrice: '3.50' },
  { name: 'Smoothie', description: 'Berry or mango', basePrice: '5.50' },
  { name: 'Iced Tea', description: 'Sweet or unsweet', basePrice: '3.25' },
  { name: 'Water', description: 'Bottled water', basePrice: '2.00' },
  { name: 'Lemonade', description: 'Fresh lemonade', basePrice: '3.50' },
  { name: 'Granola', description: 'Yogurt and granola', basePrice: '6.00' },
  { name: 'Avocado Toast', description: 'Sourdough with avocado', basePrice: '9.00' },
  { name: 'Panini', description: 'Grilled panini', basePrice: '8.50' },
  { name: 'Cake Slice', description: 'Daily cake', basePrice: '4.25' },
];

/** Deterministic PRNG so every fresh seed produces the same demo data. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);
const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
const toCents = (p: string) => Math.round(Number(p) * 100);

async function seed() {
  const passwordHash = await hashPassword(DEFAULT_PASSWORD);

  await db.transaction(async (tx) => {
    // Serialise concurrent seeds (e.g. several instances booting together); released at commit.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(482190002)`);

    // Outlets
    await tx.insert(outlets).values(SEED_OUTLETS).onConflictDoNothing();
    const outletRows = await tx
      .select({ id: outlets.id, name: outlets.name })
      .from(outlets)
      .where(inArray(outlets.name, SEED_OUTLETS.map((o) => o.name)));
    const outletId = (name: string) => outletRows.find((o) => o.name === name)!.id;
    const mainId = outletId('Main Outlet');
    const downtownId = outletId('Downtown Outlet');

    // Users
    await tx
      .insert(users)
      .values([
        { username: 'sarah.chen', passwordHash, role: ROLE_SUPERADMIN, outletId: null },
        { username: 'james.wilson', passwordHash, role: ROLE_HQ, outletId: null },
        { username: 'david.kim', passwordHash, role: ROLE_OUTLET, outletId: mainId },
        { username: 'emma.lee', passwordHash, role: ROLE_OUTLET, outletId: downtownId },
      ])
      .onConflictDoNothing({ target: users.username });

    // Master menu
    await tx.insert(menuItems).values(SEED_MENU_ITEMS).onConflictDoNothing();
    const items = await tx
      .select({ id: menuItems.id, name: menuItems.name, basePrice: menuItems.basePrice })
      .from(menuItems)
      .where(inArray(menuItems.name, SEED_MENU_ITEMS.map((m) => m.name)));

    // Assignments: Main uses base prices; Downtown overrides every 3rd item at +10%.
    const effectivePrice = new Map<string, string>();
    const assignments = [mainId, downtownId].flatMap((oid) =>
      items.map((item, i) => {
        const override = oid === downtownId && i % 3 === 0 ? (Number(item.basePrice) * 1.1).toFixed(2) : null;
        effectivePrice.set(`${oid}:${item.id}`, override ?? item.basePrice);
        return { outletId: oid, menuItemId: item.id, price: override, isActive: true };
      }),
    );
    await tx.insert(outletMenuItems).values(assignments).onConflictDoNothing();

    // Inventory
    await tx
      .insert(inventory)
      .values(
        [mainId, downtownId].flatMap((oid) =>
          items.map((item) => ({ outletId: oid, menuItemId: item.id, stock: 50 + Math.floor(rand() * 50) })),
        ),
      )
      .onConflictDoNothing();

    // Historical sales over the last 30 days (only for outlets that have none yet).
    for (const [oid, numSales] of [
      [mainId, 35],
      [downtownId, 28],
    ] as const) {
      const [{ existing }] = await tx.select({ existing: count() }).from(sales).where(eq(sales.outletId, oid));
      if (existing > 0) continue;

      const now = Date.now();
      const saleRows = Array.from({ length: numSales }, (_, s) => {
        const used = new Set<number>();
        const lines = Array.from({ length: 1 + Math.floor(rand() * 3) }, () => pick(items))
          .filter((item) => !used.has(item.id) && used.add(item.id))
          .map((item) => ({ menuItemId: item.id, quantity: 1 + Math.floor(rand() * 3), price: effectivePrice.get(`${oid}:${item.id}`)! }));
        const totalCents = lines.reduce((sum, l) => sum + toCents(l.price) * l.quantity, 0);
        // Oldest first so receipt numbers increase with time.
        const createdAt = new Date(now - (numSales - s) * (30 / numSales) * 86_400_000 + Math.floor(rand() * 3_600_000));
        return { receiptNumber: String(s + 1), totalAmount: (totalCents / 100).toFixed(2), createdAt, lines };
      });

      const inserted = await tx
        .insert(sales)
        .values(saleRows.map(({ receiptNumber, totalAmount, createdAt }) => ({ outletId: oid, receiptNumber, totalAmount, createdAt })))
        .returning({ id: sales.id, receiptNumber: sales.receiptNumber });
      const idByReceipt = new Map(inserted.map((r) => [r.receiptNumber, r.id]));

      await tx.insert(saleItems).values(
        saleRows.flatMap((s) =>
          s.lines.map((l) => ({ saleId: idByReceipt.get(s.receiptNumber)!, menuItemId: l.menuItemId, quantity: l.quantity, priceAtSale: l.price })),
        ),
      );
      // Seeded history bypasses the sale flow, so recompute this outlet's report rollups.
      await rebuildSalesRollups(tx, [oid]);
      // Continue live receipt numbering after the seeded history.
      await tx
        .update(outlets)
        .set({ receiptSeq: sql`GREATEST(${outlets.receiptSeq}, ${numSales})` })
        .where(eq(outlets.id, oid));
    }
  });

  logger.info(
    { users: ['sarah.chen (superadmin)', 'james.wilson (hqadmin)', 'david.kim (outletadmin, Main)', 'emma.lee (outletadmin, Downtown)'] },
    'Seed complete. Default password comes from SEED_PASSWORD.',
  );
}

seed()
  .catch((err) => {
    logger.error({ err }, 'Seed failed');
    process.exitCode = 1;
  })
  .finally(() => pool.end());
