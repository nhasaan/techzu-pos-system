import { Router } from 'express';
import { authenticate } from '../../shared/utils/auth';
import { validate } from '../../shared/utils/validate';
import { salesController } from './controller';
import { createSaleBodySchema, listSalesQuerySchema, outletIdParamSchema, saleIdParamSchema } from './validation';

export const salesRouter = Router();

salesRouter.post('/sales', authenticate, validate({ body: createSaleBodySchema }), salesController.create);
salesRouter.get(
  '/sales/outlet/:outletId',
  authenticate,
  validate({ params: outletIdParamSchema, query: listSalesQuerySchema }),
  salesController.listByOutlet,
);
salesRouter.get('/sales/:saleId', authenticate, validate({ params: saleIdParamSchema }), salesController.getById);
