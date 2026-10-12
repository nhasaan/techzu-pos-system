import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const USER_ROLES = ['hqadmin', 'outletadmin', 'superadmin'] as const;
export const [ROLE_HQ, ROLE_OUTLET, ROLE_SUPERADMIN] = USER_ROLES;
export type UserRole = (typeof USER_ROLES)[number];

export const TOKEN_STATUSES = ['active', 'revoked', 'consumed'] as const;
export type TokenStatus = (typeof TOKEN_STATUSES)[number];

export const userRoleEnum = pgEnum('user_role', USER_ROLES);
export const tokenStatusEnum = pgEnum('token_status', TOKEN_STATUSES);

// Identity bigints stay well inside Number.MAX_SAFE_INTEGER, so mode 'number' is lossless.
const id = () => bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity();
const fk = (name: string) => bigint(name, { mode: 'number' });
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const outlets = pgTable(
  'outlets',
  {
    id: id(),
    name: text('name').notNull(),
    address: text('address'),
    // Last issued receipt number for this outlet. Incremented under a row lock inside the
    // sale transaction, which makes receipt numbers gap-free and safe under concurrency.
    receiptSeq: bigint('receipt_seq', { mode: 'number' }).notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('outlets_name_lower_unique').on(sql`lower(${t.name})`)],
);

export const users = pgTable(
  'users',
  {
    id: id(),
    username: text('username').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    role: userRoleEnum('role').notNull(),
    outletId: fk('outlet_id').references(() => outlets.id, { onDelete: 'restrict' }),
    createdAt: createdAt(),
  },
  (t) => [
    index('users_outlet_id_idx').on(t.outletId),
    check('users_outlet_required_for_outletadmin', sql`${t.role} <> 'outletadmin' OR ${t.outletId} IS NOT NULL`),
  ],
);

// Refresh-token sessions. One row per issued refresh token (rotated on every refresh).
export const tokens = pgTable(
  'tokens',
  {
    id: id(),
    userId: fk('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    jti: text('jti').notNull().unique(),
    status: tokenStatusEnum('status').notNull().default('active'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    // When the session was revoked; used to rebuild the Redis blacklist after Redis loses data.
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('tokens_user_id_status_idx').on(t.userId, t.status), index('tokens_revoked_at_idx').on(t.revokedAt)],
);

export const menuItems = pgTable(
  'menu_items',
  {
    id: id(),
    name: text('name').notNull(),
    description: text('description'),
    basePrice: numeric('base_price', { precision: 10, scale: 2 }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('menu_items_name_lower_unique').on(sql`lower(${t.name})`),
    check('menu_items_base_price_non_negative', sql`${t.basePrice} >= 0`),
  ],
);

// Assignment of a master menu item to an outlet, with optional price override.
export const outletMenuItems = pgTable(
  'outlet_menu_items',
  {
    id: id(),
    outletId: fk('outlet_id')
      .notNull()
      .references(() => outlets.id, { onDelete: 'cascade' }),
    menuItemId: fk('menu_item_id')
      .notNull()
      .references(() => menuItems.id, { onDelete: 'cascade' }),
    price: numeric('price', { precision: 10, scale: 2 }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    // The unique constraint's index also serves (outlet_id[, menu_item_id]) lookups.
    unique('outlet_menu_items_outlet_menu_unique').on(t.outletId, t.menuItemId),
    index('outlet_menu_items_menu_item_id_idx').on(t.menuItemId),
    check('outlet_menu_items_price_non_negative', sql`${t.price} IS NULL OR ${t.price} >= 0`),
  ],
);

export const inventory = pgTable(
  'inventory',
  {
    id: id(),
    outletId: fk('outlet_id')
      .notNull()
      .references(() => outlets.id, { onDelete: 'cascade' }),
    menuItemId: fk('menu_item_id')
      .notNull()
      .references(() => menuItems.id, { onDelete: 'cascade' }),
    stock: integer('stock').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('inventory_outlet_menu_item_unique').on(t.outletId, t.menuItemId),
    index('inventory_menu_item_id_idx').on(t.menuItemId),
    // Last line of defence: the database itself rejects negative stock.
    check('inventory_stock_non_negative', sql`${t.stock} >= 0`),
  ],
);

export const sales = pgTable(
  'sales',
  {
    id: id(),
    outletId: fk('outlet_id')
      .notNull()
      .references(() => outlets.id, { onDelete: 'restrict' }),
    receiptNumber: text('receipt_number').notNull(),
    totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
    // Client-supplied key (Idempotency-Key header) so retries never create duplicate sales.
    idempotencyKey: text('idempotency_key'),
    createdBy: fk('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [
    unique('sales_outlet_receipt_unique').on(t.outletId, t.receiptNumber),
    unique('sales_outlet_idempotency_unique').on(t.outletId, t.idempotencyKey),
    index('sales_outlet_created_at_idx').on(t.outletId, t.createdAt),
    check('sales_total_non_negative', sql`${t.totalAmount} >= 0`),
  ],
);

export const saleItems = pgTable(
  'sale_items',
  {
    id: id(),
    saleId: fk('sale_id')
      .notNull()
      .references(() => sales.id, { onDelete: 'cascade' }),
    menuItemId: fk('menu_item_id')
      .notNull()
      .references(() => menuItems.id, { onDelete: 'restrict' }),
    quantity: integer('quantity').notNull(),
    priceAtSale: numeric('price_at_sale', { precision: 10, scale: 2 }).notNull(),
  },
  (t) => [
    index('sale_items_sale_id_idx').on(t.saleId),
    index('sale_items_menu_item_id_idx').on(t.menuItemId),
    check('sale_items_quantity_positive', sql`${t.quantity} > 0`),
    check('sale_items_price_non_negative', sql`${t.priceAtSale} >= 0`),
  ],
);
