import { Router } from 'express';
import { authenticate, requireHQOrSuperadmin } from '../../shared/utils/auth';
import { validate } from '../../shared/utils/validate';
import { outletsController } from './controller';
import { createOutletBodySchema, listOutletsQuerySchema } from './validation';

export const outletsRouter = Router();

outletsRouter.use('/outlets', authenticate, requireHQOrSuperadmin);
outletsRouter.get('/outlets', validate({ query: listOutletsQuerySchema }), outletsController.list);
outletsRouter.post('/outlets', validate({ body: createOutletBodySchema }), outletsController.create);
