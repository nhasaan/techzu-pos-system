import { Router } from 'express';
import { authenticate, requireSuperadmin } from '../../shared/utils/auth';
import { validate } from '../../shared/utils/validate';
import { usersController } from './controller';
import { createUserBodySchema, listUsersQuerySchema } from './validation';

export const usersRouter = Router();

usersRouter.use('/users', authenticate, requireSuperadmin);
usersRouter.get('/users', validate({ query: listUsersQuerySchema }), usersController.list);
usersRouter.post('/users', validate({ body: createUserBodySchema }), usersController.create);
