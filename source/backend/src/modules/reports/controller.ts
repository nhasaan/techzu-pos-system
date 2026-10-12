import type { Request, Response } from 'express';
import { assertOutletAccess, currentUser, isOutletUser } from '../../shared/utils/auth';
import { success } from '../../shared/utils/response';
import * as reportsService from './service';
import type { DateRangeQuery, TopItemsQuery } from './validation';

export const reportsController = {
  async summary(req: Request, res: Response) {
    const { outletId } = req.params as unknown as { outletId: number };
    assertOutletAccess(currentUser(req), outletId);
    res.json(success('OK', await reportsService.salesSummaryByOutlet(outletId, req.query as DateRangeQuery)));
  },

  async topItems(req: Request, res: Response) {
    const { outletId } = req.params as unknown as { outletId: number };
    assertOutletAccess(currentUser(req), outletId);
    res.json(success('OK', await reportsService.topItemsByOutlet(outletId, req.query as unknown as TopItemsQuery)));
  },

  async revenueByOutlet(req: Request, res: Response) {
    const user = currentUser(req);
    const scope = isOutletUser(user) ? [user.outletId ?? -1] : undefined;
    res.json(success('OK', await reportsService.revenueByOutlet(req.query as DateRangeQuery, scope)));
  },
};
