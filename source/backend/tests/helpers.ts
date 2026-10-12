import path from 'path';
import argon2 from 'argon2';
import request from 'supertest';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createApp } from '../src/app';
import { db, pool } from '../src/shared/db';
import { users, type UserRole } from '../src/shared/db/schema';

export const app = createApp();
export const api = () => request(app);
export const PASSWORD = 'test-password-123';

export async function setupDatabase() {
  const dbName = new URL(process.env.DATABASE_URL ?? '').pathname.slice(1);
  // Guard rail: these tests TRUNCATE everything.
  if (!/test/i.test(dbName)) throw new Error(`Refusing to run integration tests against non-test database "${dbName}"`);
  await migrate(db, { migrationsFolder: path.resolve(__dirname, '../drizzle') });
  await pool.query(
    'TRUNCATE sale_items, sales, inventory, outlet_menu_items, menu_items, tokens, users, outlets RESTART IDENTITY CASCADE',
  );
}

export const teardownDatabase = () => pool.end();

const hash = argon2.hash(PASSWORD);
export async function createUser(username: string, role: UserRole, outletId: number | null = null) {
  const [row] = await db.insert(users).values({ username, role, outletId, passwordHash: await hash }).returning();
  return row;
}

export async function login(username: string) {
  const res = await api().post('/api/auth/login').send({ username, password: PASSWORD }).expect(200);
  return res.body.data as { accessToken: string; refreshToken: string };
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
