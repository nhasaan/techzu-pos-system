import { Router } from 'express';
import { authenticate } from '../../shared/utils/auth';
import { loginLimiter, refreshLimiter } from '../../shared/utils/rate-limit';
import { validate } from '../../shared/utils/validate';
import { authController } from './controller';
import { loginBodySchema, refreshBodySchema } from './validation';

export const authRouter = Router();

authRouter.post('/auth/login', loginLimiter, validate({ body: loginBodySchema }), authController.login);
authRouter.post('/auth/refresh', refreshLimiter, validate({ body: refreshBodySchema }), authController.refresh);
authRouter.post('/auth/logout', authenticate, authController.logout);
