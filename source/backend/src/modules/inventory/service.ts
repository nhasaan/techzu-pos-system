import { ValidationError } from '../../shared/utils/errors';
import { isForeignKeyViolation } from '../../shared/utils/pg-errors';
import { paginate } from '../../shared/utils/schemas';
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

export async function listByOutlet(outletId: number, page: number, limit: number) {
  const { rows, total } = await inventoryRepository.listByOutlet(outletId, limit, (page - 1) * limit);
  return paginate(rows, total, page, limit);
}
