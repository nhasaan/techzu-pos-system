import { ValidationError } from '../../shared/utils/errors';
import { isForeignKeyViolation } from '../../shared/utils/pg-errors';
import { decodeCursor, nameIdKey, toCursorPage } from '../../shared/utils/pagination';
import { inventoryRepository } from './repository';
import type { SetStockBody } from './validation';

export async function setStock(body: SetStockBody) {
  try {
    return await inventoryRepository.upsertStock(body);
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      throw new ValidationError('Outlet or menu item not found', { reference: 'Outlet or menu item not found' });
    }
    throw err;
  }
}

export async function listByOutlet(outletId: number, cursor: string | undefined, limit: number) {
  const rows = await inventoryRepository.listByOutlet(outletId, limit, decodeCursor(cursor, nameIdKey));
  return toCursorPage(rows, limit, (r) => [r.itemName, r.menuItemId]);
}
