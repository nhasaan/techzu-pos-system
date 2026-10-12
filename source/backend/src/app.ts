import express from 'express';
import { config } from './shared/config';
import { errorHandler, notFoundHandler } from './shared/utils/error-handler';
import { requestLogger } from './shared/utils/request-logger';
import { apiLimiter } from './shared/utils/rate-limit';
import { securityMiddleware } from './shared/utils/security';
import { authRouter } from './modules/auth/routes';
import { healthRouter } from './modules/health/routes';
import { inventoryRouter } from './modules/inventory/routes';
import { menuRouter } from './modules/menu/routes';
import { outletsRouter } from './modules/outlets/routes';
import { salesRouter } from './modules/sales/routes';
import { usersRouter } from './modules/users/routes';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.set('etag', false);

  app.use(requestLogger);
  app.use(securityMiddleware);
  app.use(express.json({ limit: '100kb' }));

  app.use(healthRouter);

  const api = express.Router();
  api.use(apiLimiter);
  api.use(authRouter);
  api.use(outletsRouter);
  api.use(menuRouter);
  api.use(inventoryRouter);
  api.use(salesRouter);
  api.use(usersRouter);
  app.use('/api', api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
