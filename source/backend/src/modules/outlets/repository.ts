import { asc, count, eq } from 'drizzle-orm';
import { db } from '../../shared/db';
import { outlets } from '../../shared/db/schema';

const publicColumns = {
  id: outlets.id,
  name: outlets.name,
  address: outlets.address,
  createdAt: outlets.createdAt,
};

export const outletsRepository = {
  async list(limit: number, offset: number) {
    const [rows, [{ total }]] = await Promise.all([
      db.select(publicColumns).from(outlets).orderBy(asc(outlets.name)).limit(limit).offset(offset),
      db.select({ total: count() }).from(outlets),
    ]);
    return { rows, total };
  },

  async create(values: { name: string; address: string | null }) {
    const [row] = await db.insert(outlets).values(values).returning(publicColumns);
    return row;
  },

  async exists(id: number) {
    const row = await db.query.outlets.findFirst({ where: eq(outlets.id, id), columns: { id: true } });
    return Boolean(row);
  },
};
