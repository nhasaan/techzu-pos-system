import express from 'express';
import { config } from './shared/config';
import { errorHandler, notFoundHandler } from './shared/utils/error-handler';
import { requestLogger } from './shared/utils/request-logger';
import { securityMiddleware } from './shared/utils/security';
import { healthRouter } from './modules/health/routes';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.set('etag', false);

  app.use(requestLogger);
  app.use(securityMiddleware);
  app.use(express.json({ limit: '100kb' }));

  app.use(healthRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
