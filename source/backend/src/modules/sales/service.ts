import { db } from '../../shared/db';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/utils/errors';
import { isUniqueViolation } from '../../shared/utils/pg-errors';
import { decodeCursor, timestampIdKey, toCursorPage } from '../../shared/utils/pagination';
import { salesRepository } from './repository';
import type { SaleItemInput } from './validation';

const IDEMPOTENCY_CONSTRAINT = 'sales_outlet_idempotency_unique';

/** Integer cents avoid floating point drift in totals. Prices are numeric(10,2) strings. */
const toCents = (price: string) => Math.round(Number(price) * 100);
const fromCents = (cents: number) => (cents / 100).toFixed(2);

/** Merge duplicate lines for the same item; sorted by id for deterministic lock order. */
function mergeLines(items: SaleItemInput[]) {
  const qty = new Map<number, number>();
  for (const { menuItemId, quantity } of items) qty.set(menuItemId, (qty.get(menuItemId) ?? 0) + quantity);
  return [...qty.entries()].sort(([a], [b]) => a - b).map(([menuItemId, quantity]) => ({ menuItemId, quantity }));
}

export interface CreateSaleOptions {
  idempotencyKey?: string;
  userId?: number;
}

/**
 * Creates a sale atomically:
 *  1. resolve prices for items assigned + active at the outlet,
 *  2. lock the inventory rows (ordered) and verify stock,
 *  3. deduct stock in one statement,
 *  4. take the next per-outlet receipt number,
 *  5. insert the sale and its lines.
 * Any failure rolls back everything, including the receipt number.
 */
export async function createSale(outletId: number, items: SaleItemInput[], opts: CreateSaleOptions = {}) {
  const key = opts.idempotencyKey ?? null;
  const lines = mergeLines(items);
  if (key) {
    const existing = await salesRepository.findByIdempotencyKey(outletId, key);
    if (existing) return { ...(await replay(existing.id, lines)), replayed: true };
  }

  const ids = lines.map((l) => l.menuItemId);

  try {
    const created = await db.transaction(async (tx) => {
      const sellable = await salesRepository.findSellablePrices(tx, outletId, ids);
      const prices = new Map(sellable.map((p) => [p.menuItemId, p.price]));
      const names = new Map(sellable.map((p) => [p.menuItemId, p.name]));
      const missing = ids.filter((id) => !prices.has(id));
      if (missing.length) {
        throw new ValidationError(`Menu item ${missing[0]} not found or not available for this outlet`, {
          items: `Not available for this outlet: ${missing.join(', ')}`,
        });
      }

      const stock = new Map((await salesRepository.lockStock(tx, outletId, ids)).map((r) => [r.menuItemId, r.stock]));
      for (const { menuItemId, quantity } of lines) {
        const available = stock.get(menuItemId) ?? 0;
        if (available < quantity) {
          const msg = `Insufficient stock for menu item ${menuItemId}: required ${quantity}, available ${available}`;
          throw new ConflictError(msg, { stock: msg });
        }
      }
      await salesRepository.deductStock(tx, outletId, lines);

      const seq = await salesRepository.nextReceiptNumber(tx, outletId);
      if (seq == null) throw new NotFoundError('Outlet not found', { outletId: 'Not found' });

      const totalCents = lines.reduce((sum, l) => sum + toCents(prices.get(l.menuItemId)!) * l.quantity, 0);
      const totalAmount = fromCents(totalCents);
      const sale = await salesRepository.insertSale(tx, {
        outletId,
        receiptNumber: String(seq),
        totalAmount,
        idempotencyKey: key,
        createdBy: opts.userId ?? null,
      });
      const saleItemRows = await salesRepository.insertSaleItems(
        tx,
        lines.map((l) => ({
          saleId: sale.id,
          menuItemId: l.menuItemId,
          quantity: l.quantity,
          priceAtSale: fromCents(toCents(prices.get(l.menuItemId)!)),
        })),
      );
      // Same item shape as the receipt endpoint and idempotent replays.
      const itemsWithNames = saleItemRows.map((r) => ({ ...r, itemName: names.get(r.menuItemId) ?? null }));
      return { sale, items: itemsWithNames, receiptNumber: sale.receiptNumber, totalAmount };
    });
    return { ...created, replayed: false };
  } catch (err) {
    // Two concurrent requests with the same Idempotency-Key: the loser returns the winner's sale.
    if (key && isUniqueViolation(err, IDEMPOTENCY_CONSTRAINT)) {
      const existing = await salesRepository.findByIdempotencyKey(outletId, key);
      if (existing) return { ...(await replay(existing.id, lines)), replayed: true };
    }
    throw err;
  }
}

/**
 * Returns the sale previously created with this Idempotency-Key. The key must identify the same
 * request: reusing it for a different basket is a client bug, so it is rejected instead of
 * silently returning (and the client treating as paid) a sale with other items.
 */
async function replay(saleId: number, lines: { menuItemId: number; quantity: number }[]) {
  const sale = await salesRepository.findById(saleId);
  if (!sale) throw new NotFoundError('Sale not found', { saleId: 'Not found' });
  const items = await salesRepository.findItemsWithNames(saleId);
  const stored = items.map((i) => `${i.menuItemId}:${i.quantity}`).sort().join(',');
  const requested = lines.map((l) => `${l.menuItemId}:${l.quantity}`).sort().join(',');
  if (stored !== requested) {
    throw new ValidationError('Idempotency-Key was already used for a different sale', {
      'Idempotency-Key': 'Already used with different items',
    });
  }
  return { sale, items, receiptNumber: sale.receiptNumber, totalAmount: sale.totalAmount };
}

export async function listByOutlet(outletId: number, cursor: string | undefined, limit: number) {
  const rows = await salesRepository.listByOutlet(outletId, limit, decodeCursor(cursor, timestampIdKey));
  return toCursorPage(
    rows,
    limit,
    (r) => [r.cursorTs, r.id],
    ({ cursorTs: _cursorTs, ...sale }) => sale,
  );
}

export async function getSaleWithItems(saleId: number) {
  const sale = await salesRepository.findById(saleId);
  if (!sale) return null;
  const items = await salesRepository.findItemsWithNames(saleId);
  return { ...sale, items };
}
