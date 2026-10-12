import argon2 from 'argon2';
import { ROLE_OUTLET } from '../../shared/db/schema';
import { ConflictError, ValidationError } from '../../shared/utils/errors';
import { isForeignKeyViolation, isUniqueViolation } from '../../shared/utils/pg-errors';
import { paginate } from '../../shared/utils/schemas';
import { usersRepository } from './repository';
import type { CreateUserBody } from './validation';

export async function listUsers(page: number, limit: number) {
  const { rows, total } = await usersRepository.list(limit, (page - 1) * limit);
  return paginate(rows, total, page, limit);
}

export async function createUser(body: CreateUserBody) {
  const passwordHash = await argon2.hash(body.password);
  try {
    return await usersRepository.create({
      username: body.username,
      passwordHash,
      role: body.role,
      // Only outlet admins are bound to an outlet.
      outletId: body.role === ROLE_OUTLET ? (body.outletId ?? null) : null,
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new ConflictError('Username already exists', { username: 'Already taken' });
    if (isForeignKeyViolation(err)) throw new ValidationError('Outlet not found', { outletId: 'Not found' });
    throw err;
  }
}
