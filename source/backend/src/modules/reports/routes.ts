import { Router } from 'express';
import { authenticate } from '../../shared/utils/auth';
import { validate } from '../../shared/utils/validate';
import { reportsController } from './controller';
import { outletIdParamSchema, salesSummaryQuerySchema, topItemsQuerySchema } from './validation';

export const reportsRouter = Router();

reportsRouter.use('/reports', authenticate);
reportsRouter.get('/reports/revenue-by-outlet', validate({ query: salesSummaryQuerySchema }), reportsController.revenueByOutlet);
reportsRouter.get(
  '/reports/outlet/:outletId/summary',
  validate({ params: outletIdParamSchema, query: salesSummaryQuerySchema }),
  reportsController.summary,
);
reportsRouter.get(
  '/reports/outlet/:outletId/top-items',
  validate({ params: outletIdParamSchema, query: topItemsQuerySchema }),
  reportsController.topItems,
);
