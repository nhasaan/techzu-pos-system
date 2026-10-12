import { asc, gt } from 'drizzle-orm';
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
  /** Keyset page ordered by username (unique), served by users_username_unique. */
  list(limit: number, after?: readonly [string]) {
    return db
      .select(publicColumns)
      .from(users)
      .where(after ? gt(users.username, after[0]) : undefined)
      .orderBy(asc(users.username))
      .limit(limit + 1);
  },

  async create(values: { username: string; passwordHash: string; role: UserRole; outletId: number | null }) {
    const [row] = await db.insert(users).values(values).returning(publicColumns);
    return row;
  },
};
