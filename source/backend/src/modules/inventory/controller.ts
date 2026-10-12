import type { Request, Response } from 'express';
import { assertOutletAccess, currentUser } from '../../shared/utils/auth';
import { success } from '../../shared/utils/response';
import type { CursorQuery } from '../../shared/utils/pagination';
import * as inventoryService from './service';
import type { AdjustStockBody, SetStockBody } from './validation';

export const inventoryController = {
  async setStock(req: Request, res: Response) {
    const body = req.body as SetStockBody;
    assertOutletAccess(currentUser(req), body.outletId);
    const row = await inventoryService.setStock(body);
    req.log.info({ outletId: body.outletId, menuItemId: body.menuItemId, stock: body.stock }, 'Stock set');
    res.json(success('Stock updated', row));
  },

  async adjustStock(req: Request, res: Response) {
    const body = req.body as AdjustStockBody;
    assertOutletAccess(currentUser(req), body.outletId);
    const row = await inventoryService.adjustStock(body);
    req.log.info({ outletId: body.outletId, menuItemId: body.menuItemId, delta: body.delta, stock: row.stock }, 'Stock adjusted');
    res.json(success('Stock adjusted', row));
  },

  async listByOutlet(req: Request, res: Response) {
    const { outletId } = req.params as unknown as { outletId: number };
    const { cursor, limit } = req.query as unknown as CursorQuery;
    assertOutletAccess(currentUser(req), outletId);
    res.json(success('OK', await inventoryService.listByOutlet(outletId, cursor, limit)));
  },
};
