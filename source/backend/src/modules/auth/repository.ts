import { and, eq, gt, sql } from 'drizzle-orm';
import { db, type DbExecutor } from '../../shared/db';
import { tokens, users } from '../../shared/db/schema';

export const authRepository = {
  findUserByUsername(username: string) {
    return db.query.users.findFirst({ where: eq(users.username, username) });
  },

  findUserById(id: number) {
    return db.query.users.findFirst({ where: eq(users.id, id) });
  },

  async insertSession(exec: DbExecutor, userId: number, jti: string, expiresAt: Date) {
    await exec.insert(tokens).values({ userId, jti, status: 'active', expiresAt });
  },

  /**
   * Atomically consumes an active, unexpired refresh session. Concurrent refreshes of the same
   * token race on this single UPDATE, so exactly one can win.
   */
  async consumeActiveSession(exec: DbExecutor, jti: string) {
    const rows = await exec
      .update(tokens)
      .set({ status: 'consumed', consumedAt: new Date() })
      .where(and(eq(tokens.jti, jti), eq(tokens.status, 'active'), gt(tokens.expiresAt, sql`now()`)))
      .returning({ id: tokens.id, userId: tokens.userId });
    return rows[0] ?? null;
  },

  findSessionByJti(jti: string) {
    return db.query.tokens.findFirst({ where: eq(tokens.jti, jti), columns: { status: true, userId: true, consumedAt: true } });
  },

  async revokeSession(jti: string) {
    await db.update(tokens).set({ status: 'revoked' }).where(eq(tokens.jti, jti));
  },

  /** Revokes every non-revoked session for a user and returns their jtis (to blacklist access tokens). */
  async revokeAllSessions(userId: number): Promise<string[]> {
    const rows = await db
      .update(tokens)
      .set({ status: 'revoked' })
      .where(and(eq(tokens.userId, userId), sql`${tokens.status} <> 'revoked'`, gt(tokens.expiresAt, sql`now()`)))
      .returning({ jti: tokens.jti });
    return rows.map((r) => r.jti);
  },
};
