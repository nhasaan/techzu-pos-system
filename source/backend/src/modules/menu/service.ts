import { ConflictError, ValidationError } from '../../shared/utils/errors';
import { isForeignKeyViolation, isUniqueViolation } from '../../shared/utils/pg-errors';
import { decodeCursor, nameIdKey, toCursorPage, type CursorPage } from '../../shared/utils/pagination';
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

export async function listMasterMenu(cursor: string | undefined, limit: number) {
  const rows = await menuRepository.listItems(limit, decodeCursor(cursor, nameIdKey));
  return toCursorPage(rows, limit, (r) => [r.name, r.id]);
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

export async function listByOutlet(outletId: number, cursor: string | undefined, limit: number): Promise<CursorPage<OutletMenuRow>> {
  const after = decodeCursor(cursor, nameIdKey);
  const cached = await outletMenuCache.get<CursorPage<OutletMenuRow>>(outletId, cursor, limit);
  if (cached.value) return cached.value;

  const rows = await menuRepository.listByOutlet(outletId, limit, after);
  const result = toCursorPage(rows, limit, (r) => [r.name, r.id]);
  await outletMenuCache.set(outletId, cached.version, cursor, limit, result);
  return result;
}
