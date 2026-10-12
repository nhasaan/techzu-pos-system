import { db } from '../../shared/db';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/utils/errors';
import { isUniqueViolation } from '../../shared/utils/pg-errors';
import { paginate } from '../../shared/utils/schemas';
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
  if (key) {
    const existing = await salesRepository.findByIdempotencyKey(outletId, key);
    if (existing) return { ...(await getCreatedSale(existing.id)), replayed: true };
  }

  const lines = mergeLines(items);
  const ids = lines.map((l) => l.menuItemId);

  try {
    const created = await db.transaction(async (tx) => {
      const prices = new Map(
        (await salesRepository.findSellablePrices(tx, outletId, ids)).map((p) => [p.menuItemId, p.price]),
      );
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
      return { sale, items: saleItemRows, receiptNumber: sale.receiptNumber, totalAmount };
    });
    return { ...created, replayed: false };
  } catch (err) {
    // Two concurrent requests with the same Idempotency-Key: the loser returns the winner's sale.
    if (key && isUniqueViolation(err, IDEMPOTENCY_CONSTRAINT)) {
      const existing = await salesRepository.findByIdempotencyKey(outletId, key);
      if (existing) return { ...(await getCreatedSale(existing.id)), replayed: true };
    }
    throw err;
  }
}

async function getCreatedSale(saleId: number) {
  const sale = await salesRepository.findById(saleId);
  if (!sale) throw new NotFoundError('Sale not found', { saleId: 'Not found' });
  const items = await salesRepository.findItemsWithNames(saleId);
  return { sale, items, receiptNumber: sale.receiptNumber, totalAmount: sale.totalAmount };
}

export async function listByOutlet(outletId: number, page: number, limit: number) {
  const { rows, total } = await salesRepository.listByOutlet(outletId, limit, (page - 1) * limit);
  return paginate(rows, total, page, limit);
}

export async function getSaleWithItems(saleId: number) {
  const sale = await salesRepository.findById(saleId);
  if (!sale) return null;
  const items = await salesRepository.findItemsWithNames(saleId);
  return { ...sale, items };
}
