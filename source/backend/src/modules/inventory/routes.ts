import { Router } from 'express';
import { authenticate } from '../../shared/utils/auth';
import { validate } from '../../shared/utils/validate';
import { inventoryController } from './controller';
import { listInventoryQuerySchema, outletIdParamSchema, setStockBodySchema } from './validation';

export const inventoryRouter = Router();

inventoryRouter.put('/inventory', authenticate, validate({ body: setStockBodySchema }), inventoryController.setStock);
inventoryRouter.get(
  '/inventory/outlet/:outletId',
  authenticate,
  validate({ params: outletIdParamSchema, query: listInventoryQuerySchema }),
  inventoryController.listByOutlet,
);
