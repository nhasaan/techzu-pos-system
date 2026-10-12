import type { Request, Response } from 'express';
import { success } from '../../shared/utils/response';
import type { CursorQuery } from '../../shared/utils/pagination';
import * as outletsService from './service';
import type { CreateOutletBody } from './validation';

export const outletsController = {
  async list(req: Request, res: Response) {
    const { cursor, limit } = req.query as unknown as CursorQuery;
    res.json(success('OK', await outletsService.listOutlets(cursor, limit)));
  },

  async create(req: Request, res: Response) {
    const outlet = await outletsService.createOutlet(req.body as CreateOutletBody);
    req.log.info({ outletId: outlet.id }, 'Outlet created');
    res.status(201).json(success('Outlet created', outlet));
  },
};
