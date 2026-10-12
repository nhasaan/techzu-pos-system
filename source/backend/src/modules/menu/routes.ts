import { Router } from 'express';
import { authenticate, requireHQOrSuperadmin } from '../../shared/utils/auth';
import { validate } from '../../shared/utils/validate';
import { menuController } from './controller';
import {
  assignToOutletBodySchema,
  createMenuItemBodySchema,
  listMenuQuerySchema,
  outletIdParamSchema,
} from './validation';

export const menuRouter = Router();

menuRouter.post('/menu', authenticate, requireHQOrSuperadmin, validate({ body: createMenuItemBodySchema }), menuController.create);
menuRouter.post('/menu/assign', authenticate, requireHQOrSuperadmin, validate({ body: assignToOutletBodySchema }), menuController.assign);
menuRouter.get('/menu', authenticate, requireHQOrSuperadmin, validate({ query: listMenuQuerySchema }), menuController.listMaster);
menuRouter.get(
  '/menu/outlet/:outletId',
  authenticate,
  validate({ params: outletIdParamSchema, query: listMenuQuerySchema }),
  menuController.listByOutlet,
);
