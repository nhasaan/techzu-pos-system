import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pool } from '../../src/shared/db';
import { api, bearer, createUser, login, setupDatabase, teardownDatabase } from '../helpers';

let hq: string;
let outletAdmin: string;
let mainId: number;
let otherId: number;
const item: Record<string, number> = {};

describe('HQ -> outlet -> sales -> reports flow', () => {
  beforeAll(async () => {
    await setupDatabase();
    await createUser('hq', 'hqadmin');
    hq = (await login('hq')).accessToken;

    mainId = (await api().post('/api/outlets').set(bearer(hq)).send({ name: 'Main' }).expect(201)).body.data.id;
    otherId = (await api().post('/api/outlets').set(bearer(hq)).send({ name: 'Other' }).expect(201)).body.data.id;

    await createUser('cashier', 'outletadmin', mainId);
    outletAdmin = (await login('cashier')).accessToken;

    for (const [name, basePrice] of [['Latte', '4.00'], ['Bagel', '3.25'], ['Secret', '9.99']]) {
      item[name] = (await api().post('/api/menu').set(bearer(hq)).send({ name, basePrice }).expect(201)).body.data.id;
    }
  });
  afterAll(teardownDatabase);

  describe('master menu and assignment', () => {
    it('rejects duplicate menu item names (case-insensitive)', async () => {
      expect((await api().post('/api/menu').set(bearer(hq)).send({ name: 'latte', basePrice: '1' })).status).toBe(409);
    });

    it('assigns items with a price override', async () => {
      await api().post('/api/menu/assign').set(bearer(hq)).send({ outletId: mainId, menuItemId: item.Latte, price: '4.50' }).expect(200);
      await api().post('/api/menu/assign').set(bearer(hq)).send({ outletId: mainId, menuItemId: item.Bagel }).expect(200);
    });

    it('returns only items assigned to the outlet', async () => {
      const res = await api().get(`/api/menu/outlet/${mainId}`).set(bearer(outletAdmin)).expect(200);
      expect(res.body.data.items.map((i: { name: string }) => i.name)).toEqual(['Bagel', 'Latte']);
      expect(res.body.data.items.find((i: { name: string }) => i.name === 'Latte').outletPrice).toBe('4.50');
    });

    it('returns 422 when assigning to an unknown outlet', async () => {
      const res = await api().post('/api/menu/assign').set(bearer(hq)).send({ outletId: 999999, menuItemId: item.Latte });
      expect(res.status).toBe(422);
    });
  });

  describe('role and outlet scoping', () => {
    it('blocks outlet admins from HQ endpoints', async () => {
      expect((await api().post('/api/menu').set(bearer(outletAdmin)).send({ name: 'X', basePrice: '1' })).status).toBe(403);
      expect((await api().get('/api/outlets').set(bearer(outletAdmin))).status).toBe(403);
    });

    it('blocks outlet admins from other outlets', async () => {
      expect((await api().get(`/api/menu/outlet/${otherId}`).set(bearer(outletAdmin))).status).toBe(403);
      expect((await api().get(`/api/sales/outlet/${otherId}`).set(bearer(outletAdmin))).status).toBe(403);
      const res = await api().put('/api/inventory').set(bearer(outletAdmin)).send({ outletId: otherId, menuItemId: item.Latte, stock: 5 });
      expect(res.status).toBe(403);
    });
  });

  describe('sales', () => {
    beforeAll(async () => {
      await api().put('/api/inventory').set(bearer(outletAdmin)).send({ outletId: mainId, menuItemId: item.Latte, stock: 20 }).expect(200);
      await api().put('/api/inventory').set(bearer(outletAdmin)).send({ outletId: mainId, menuItemId: item.Bagel, stock: 500 }).expect(200);
      await api().put('/api/inventory').set(bearer(hq)).send({ outletId: mainId, menuItemId: item.Secret, stock: 500 }).expect(200);
    });

    it('rejects items not assigned to the outlet', async () => {
      const res = await api().post('/api/sales').set(bearer(outletAdmin)).send({ items: [{ menuItemId: item.Secret, quantity: 1 }] });
      expect(res.status).toBe(422);
    });

    it('requires outletId for HQ users', async () => {
      const res = await api().post('/api/sales').set(bearer(hq)).send({ items: [{ menuItemId: item.Latte, quantity: 1 }] });
      expect(res.status).toBe(422);
    });

    it('never oversells and keeps receipts sequential under concurrency', async () => {
      // 40 concurrent sales of 1 Latte each against stock 20; half also include a Bagel in reverse order.
      const results = await Promise.all(
        Array.from({ length: 40 }, (_, i) =>
          api()
            .post('/api/sales')
            .set(bearer(outletAdmin))
            .send({
              items:
                i % 2
                  ? [{ menuItemId: item.Latte, quantity: 1 }, { menuItemId: item.Bagel, quantity: 2 }]
                  : [{ menuItemId: item.Bagel, quantity: 2 }, { menuItemId: item.Latte, quantity: 1 }],
            }),
        ),
      );
      const created = results.filter((r) => r.status === 201);
      const rejected = results.filter((r) => r.status === 409);
      expect(created).toHaveLength(20);
      expect(rejected).toHaveLength(20);

      const receipts = created.map((r) => Number(r.body.data.receiptNumber)).sort((a, b) => a - b);
      expect(receipts).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
      expect(created[0].body.data.totalAmount).toBe('11.00'); // 4.50 override + 2 x 3.25

      const { rows } = await pool.query('SELECT menu_item_id, stock FROM inventory WHERE outlet_id = $1', [mainId]);
      const stock = Object.fromEntries(rows.map((r) => [Number(r.menu_item_id), r.stock]));
      expect(stock[item.Latte]).toBe(0);
      expect(stock[item.Bagel]).toBe(500 - 20 * 2);
    });

    it('returns 409 with available stock when insufficient', async () => {
      const res = await api().post('/api/sales').set(bearer(outletAdmin)).send({ items: [{ menuItemId: item.Latte, quantity: 1 }] });
      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/available 0/);
    });

    it('rolls back the whole sale (including the receipt number) when one line fails', async () => {
      const res = await api()
        .post('/api/sales')
        .set(bearer(outletAdmin))
        .send({ items: [{ menuItemId: item.Bagel, quantity: 1 }, { menuItemId: item.Latte, quantity: 1 }] });
      expect(res.status).toBe(409);
      const ok = await api().post('/api/sales').set(bearer(outletAdmin)).send({ items: [{ menuItemId: item.Bagel, quantity: 1 }] }).expect(201);
      expect(ok.body.data.receiptNumber).toBe('21');
    });

    it('is idempotent per Idempotency-Key, even for concurrent retries', async () => {
      const send = () =>
        api().post('/api/sales').set(bearer(outletAdmin)).set('Idempotency-Key', 'order-abc-1').send({ items: [{ menuItemId: item.Bagel, quantity: 1 }] });
      const results = await Promise.all([send(), send(), send()]);
      const ids = new Set(results.map((r) => r.body.data.sale.id));
      expect(ids.size).toBe(1);
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      expect(results.filter((r) => r.headers['idempotent-replayed'] === 'true')).toHaveLength(2);
    });

    it('rejects reusing an Idempotency-Key for a different sale', async () => {
      const res = await api()
        .post('/api/sales')
        .set(bearer(outletAdmin))
        .set('Idempotency-Key', 'order-abc-1')
        .send({ items: [{ menuItemId: item.Bagel, quantity: 5 }] });
      expect(res.status).toBe(422);
    });

    it('returns item names in the create response, same shape as the receipt', async () => {
      const res = await api().post('/api/sales').set(bearer(outletAdmin)).send({ items: [{ menuItemId: item.Bagel, quantity: 1 }] }).expect(201);
      expect(res.body.data.items[0].itemName).toBe('Bagel');
    });

    it('returns the receipt with item names', async () => {
      const list = await api().get(`/api/sales/outlet/${mainId}`).set(bearer(outletAdmin)).expect(200);
      const saleId = list.body.data.items[0].id;
      const res = await api().get(`/api/sales/${saleId}`).set(bearer(outletAdmin)).expect(200);
      expect(res.body.data.items[0].itemName).toBeTruthy();
    });
  });

  describe('reports', () => {
    it('summarises revenue for an outlet', async () => {
      const res = await api().get(`/api/reports/outlet/${mainId}/summary`).set(bearer(hq)).expect(200);
      // 20 x 11.00 + 3 single-bagel sales x 3.25 (incl. the idempotent one)
      expect(res.body.data).toMatchObject({ outletId: mainId, transactionCount: 23, totalRevenue: 229.75 });
    });

    it('lists top items by quantity', async () => {
      const res = await api().get(`/api/reports/outlet/${mainId}/top-items`).set(bearer(outletAdmin)).expect(200);
      expect(res.body.data.items.map((i: { name: string; quantitySold: number }) => [i.name, i.quantitySold])).toEqual([
        ['Bagel', 43],
        ['Latte', 20],
      ]);
    });

    it('reports revenue by outlet for HQ, scoped for outlet admins', async () => {
      const all = await api().get('/api/reports/revenue-by-outlet').set(bearer(hq)).expect(200);
      expect(all.body.data.items.map((r: { outletId: number }) => r.outletId).sort()).toEqual([mainId, otherId].sort());
      const own = await api().get('/api/reports/revenue-by-outlet').set(bearer(outletAdmin)).expect(200);
      expect(own.body.data.items).toHaveLength(1);
      expect(own.body.data.items[0].outletId).toBe(mainId);
    });

    it('rejects impossible calendar dates', async () => {
      const res = await api().get(`/api/reports/outlet/${mainId}/summary?dateFrom=2026-02-31`).set(bearer(hq));
      expect(res.status).toBe(422);
    });

    it('filters by date range', async () => {
      const res = await api().get(`/api/reports/outlet/${mainId}/summary?dateFrom=2000-01-01&dateTo=2000-01-31`).set(bearer(hq)).expect(200);
      expect(res.body.data.transactionCount).toBe(0);
    });
  });
});
