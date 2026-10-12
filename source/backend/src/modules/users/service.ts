import argon2 from 'argon2';
import { ROLE_OUTLET } from '../../shared/db/schema';
import { ConflictError, ValidationError } from '../../shared/utils/errors';
import { isForeignKeyViolation, isUniqueViolation } from '../../shared/utils/pg-errors';
import { decodeCursor, textKey, toCursorPage } from '../../shared/utils/pagination';
import { usersRepository } from './repository';
import type { CreateUserBody } from './validation';

export async function listUsers(cursor: string | undefined, limit: number) {
  const rows = await usersRepository.list(limit, decodeCursor(cursor, textKey));
  return toCursorPage(rows, limit, (r) => [r.username]);
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
