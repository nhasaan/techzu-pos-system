import { ConflictError } from '../../shared/utils/errors';
import { isUniqueViolation } from '../../shared/utils/pg-errors';
import { decodeCursor, nameIdKey, toCursorPage } from '../../shared/utils/pagination';
import { outletsRepository } from './repository';
import type { CreateOutletBody } from './validation';

export async function listOutlets(cursor: string | undefined, limit: number) {
  const rows = await outletsRepository.list(limit, decodeCursor(cursor, nameIdKey));
  return toCursorPage(rows, limit, (r) => [r.name, r.id]);
}

export async function createOutlet(body: CreateOutletBody) {
  try {
    return await outletsRepository.create({ name: body.name, address: body.address ?? null });
  } catch (err) {
    if (isUniqueViolation(err)) throw new ConflictError('Outlet name already exists', { name: 'Already taken' });
    throw err;
  }
}
