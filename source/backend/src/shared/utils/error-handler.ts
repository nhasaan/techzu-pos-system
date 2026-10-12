import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError } from './errors';
import { fail } from './response';
import {
  isCheckViolation,
  isDbUnavailable,
  isForeignKeyViolation,
  isLockTimeout,
  isQueryTimeout,
  isUniqueViolation,
} from './pg-errors';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json(fail(`Route ${req.method} ${req.path} not found`, { route: 'Not found' }));
};

/**
 * Single place that turns any thrown error into the standard response envelope.
 * Express 5 forwards rejected promises from async handlers here automatically.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (res.headersSent) {
    req.log?.error({ err }, 'Error after headers were sent');
    return;
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) req.log?.error({ err }, err.message);
    res.status(err.statusCode).json(fail(err.message, err.errors));
    return;
  }

  // body-parser errors (malformed JSON, oversized payload)
  const bodyErr = err as { type?: string; status?: number };
  if (bodyErr?.type === 'entity.parse.failed') {
    res.status(400).json(fail('Bad request', { body: 'Invalid JSON or Content-Type' }));
    return;
  }
  if (bodyErr?.type === 'entity.too.large') {
    res.status(413).json(fail('Payload too large', { body: 'Too large' }));
    return;
  }

  if (isUniqueViolation(err)) {
    res.status(409).json(fail('Resource already exists', { conflict: (err as { constraint?: string }).constraint ?? 'unique' }));
    return;
  }
  if (isForeignKeyViolation(err)) {
    res.status(422).json(fail('Referenced resource does not exist', { reference: (err as { constraint?: string }).constraint ?? 'foreign key' }));
    return;
  }
  if (isCheckViolation(err)) {
    res.status(422).json(fail('Constraint violated', { constraint: (err as { constraint?: string }).constraint ?? 'check' }));
    return;
  }
  if (isLockTimeout(err)) {
    req.log?.warn({ err }, 'Lock wait timed out');
    res.setHeader('Retry-After', '1');
    res.status(503).json(fail('Service busy, please retry', { database: 'Busy' }));
    return;
  }
  if (isDbUnavailable(err) || isQueryTimeout(err)) {
    req.log?.error({ err }, 'Database unavailable');
    res.status(503).json(fail('Service temporarily unavailable', { database: 'Unavailable' }));
    return;
  }

  req.log?.error({ err }, 'Unhandled error');
  // Never leak internal messages / stack traces to clients.
  res.status(500).json(fail('Internal server error', { server: 'Unexpected error' }));
};
