import { ConflictError } from '../../shared/utils/errors';
import { isUniqueViolation } from '../../shared/utils/pg-errors';
import { paginate } from '../../shared/utils/schemas';
import { outletsRepository } from './repository';
import type { CreateOutletBody } from './validation';

export async function listOutlets(page: number, limit: number) {
  const { rows, total } = await outletsRepository.list(limit, (page - 1) * limit);
  return paginate(rows, total, page, limit);
}

export async function createOutlet(body: CreateOutletBody) {
  try {
    return await outletsRepository.create({ name: body.name, address: body.address ?? null });
  } catch (err) {
    if (isUniqueViolation(err)) throw new ConflictError('Outlet name already exists', { name: 'Already taken' });
    throw err;
  }
}
