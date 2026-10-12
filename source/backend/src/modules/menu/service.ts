import { ConflictError, ValidationError } from '../../shared/utils/errors';
import { isForeignKeyViolation, isUniqueViolation } from '../../shared/utils/pg-errors';
import { paginate, type Paginated } from '../../shared/utils/schemas';
import { outletMenuCache } from './cache';
import { menuRepository, type OutletMenuRow } from './repository';
import type { AssignToOutletBody, CreateMenuItemBody } from './validation';

export async function createMenuItem(body: CreateMenuItemBody) {
  try {
    return await menuRepository.createItem({
      name: body.name,
      description: body.description ?? null,
      basePrice: body.basePrice,
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new ConflictError('Menu item name already exists', { name: 'Already taken' });
    throw err;
  }
}

export async function listMasterMenu(page: number, limit: number) {
  const { rows, total } = await menuRepository.listItems(limit, (page - 1) * limit);
  return paginate(rows, total, page, limit);
}

export async function assignToOutlet(body: AssignToOutletBody) {
  let row;
  try {
    row = await menuRepository.upsertAssignment({
      outletId: body.outletId,
      menuItemId: body.menuItemId,
      price: body.price ?? null,
      isActive: body.isActive,
    });
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      throw new ValidationError('Outlet or menu item not found', { reference: 'Outlet or menu item not found' });
    }
    throw err;
  }
  await outletMenuCache.invalidate(body.outletId);
  const menuItem = await menuRepository.findItemById(row.menuItemId);
  return { ...row, menuItem };
}

export async function listByOutlet(outletId: number, page: number, limit: number): Promise<Paginated<OutletMenuRow>> {
  const cached = await outletMenuCache.get<Paginated<OutletMenuRow>>(outletId, page, limit);
  if (cached.value) return cached.value;

  const { rows, total } = await menuRepository.listByOutlet(outletId, limit, (page - 1) * limit);
  const result = paginate(rows, total, page, limit);
  await outletMenuCache.set(outletId, cached.version, page, limit, result);
  return result;
}
