import type { Request, Response } from 'express';
import { assertOutletAccess, currentUser } from '../../shared/utils/auth';
import { success } from '../../shared/utils/response';
import type { CursorQuery } from '../../shared/utils/pagination';
import * as menuService from './service';
import type { AssignToOutletBody, CreateMenuItemBody } from './validation';

export const menuController = {
  async create(req: Request, res: Response) {
    const item = await menuService.createMenuItem(req.body as CreateMenuItemBody);
    req.log.info({ menuItemId: item.id }, 'Menu item created');
    res.status(201).json(success('Menu item created', item));
  },

  async assign(req: Request, res: Response) {
    const body = req.body as AssignToOutletBody;
    const result = await menuService.assignToOutlet(body);
    req.log.info({ outletId: body.outletId, menuItemId: body.menuItemId }, 'Menu assigned to outlet');
    res.json(success('Menu assigned to outlet', result));
  },

  async listMaster(req: Request, res: Response) {
    const { cursor, limit } = req.query as unknown as CursorQuery;
    res.json(success('OK', await menuService.listMasterMenu(cursor, limit)));
  },

  async listByOutlet(req: Request, res: Response) {
    const { outletId } = req.params as unknown as { outletId: number };
    const { cursor, limit } = req.query as unknown as CursorQuery;
    assertOutletAccess(currentUser(req), outletId);
    res.json(success('OK', await menuService.listByOutlet(outletId, cursor, limit)));
  },
};
