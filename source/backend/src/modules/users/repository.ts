import { asc, count } from 'drizzle-orm';
import { db } from '../../shared/db';
import { users, type UserRole } from '../../shared/db/schema';

// Never select password_hash for API responses.
const publicColumns = {
  id: users.id,
  username: users.username,
  role: users.role,
  outletId: users.outletId,
  createdAt: users.createdAt,
};

export const usersRepository = {
  async list(limit: number, offset: number) {
    const [rows, [{ total }]] = await Promise.all([
      db.select(publicColumns).from(users).orderBy(asc(users.username)).limit(limit).offset(offset),
      db.select({ total: count() }).from(users),
    ]);
    return { rows, total };
  },

  async create(values: { username: string; passwordHash: string; role: UserRole; outletId: number | null }) {
    const [row] = await db.insert(users).values(values).returning(publicColumns);
    return row;
  },
};
