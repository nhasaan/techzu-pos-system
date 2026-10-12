import { asc, eq, sql } from 'drizzle-orm';
import { db } from '../../shared/db';
import { outlets } from '../../shared/db/schema';

const publicColumns = {
  id: outlets.id,
  name: outlets.name,
  address: outlets.address,
  createdAt: outlets.createdAt,
};

export const outletsRepository = {
  /** Keyset page ordered by (name, id); served by outlets_name_id_idx. */
  list(limit: number, after?: readonly [string, number]) {
    return db
      .select(publicColumns)
      .from(outlets)
      .where(after ? sql`(${outlets.name}, ${outlets.id}) > (${after[0]}, ${after[1]})` : undefined)
      .orderBy(asc(outlets.name), asc(outlets.id))
      .limit(limit + 1);
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
