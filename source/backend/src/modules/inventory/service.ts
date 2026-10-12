import { ConflictError, ValidationError } from '../../shared/utils/errors';
import { isCheckViolation, isForeignKeyViolation } from '../../shared/utils/pg-errors';
import { decodeCursor, nameIdKey, toCursorPage } from '../../shared/utils/pagination';
import { inventoryRepository } from './repository';
import type { AdjustStockBody, SetStockBody } from './validation';

const notFound = () => new ValidationError('Outlet or menu item not found', { reference: 'Outlet or menu item not found' });

export async function setStock(body: SetStockBody) {
  const { expectedStock, ...values } = body;
  try {
    if (expectedStock === undefined) return await inventoryRepository.upsertStock(values);

    const row =
      (await inventoryRepository.setStockIfUnchanged({ ...values, expectedStock })) ??
      (expectedStock === 0 ? await inventoryRepository.insertStockIfAbsent(values) : null);
    if (!row) {
      throw new ConflictError('Stock changed since it was read (sales or another update); reload and try again', {
        stock: 'Changed since read',
      });
    }
    return row;
  } catch (err) {
    if (isForeignKeyViolation(err)) throw notFound();
    throw err;
  }
}

export async function adjustStock(body: AdjustStockBody) {
  try {
    const row = await inventoryRepository.adjustStock(body);
    if (!row) throw new ConflictError('Adjustment would make stock negative', { stock: 'Would go negative' });
    return row;
  } catch (err) {
    if (isCheckViolation(err)) throw new ConflictError('Adjustment would make stock negative', { stock: 'Would go negative' });
    if (isForeignKeyViolation(err)) throw notFound();
    throw err;
  }
}

export async function listByOutlet(outletId: number, cursor: string | undefined, limit: number) {
  const rows = await inventoryRepository.listByOutlet(outletId, limit, decodeCursor(cursor, nameIdKey));
  return toCursorPage(rows, limit, (r) => [r.itemName, r.menuItemId]);
}
