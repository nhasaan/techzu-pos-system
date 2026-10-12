import type { RequestHandler } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import { ValidationError } from './errors';

type Source = 'body' | 'query' | 'params';
type Schemas = Partial<Record<Source, ZodTypeAny>>;

function toErrors(err: ZodError, source: Source): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join('.') || source;
    errors[key] ??= issue.message;
  }
  return errors;
}

/**
 * Validates and coerces request input. Parsed values replace the raw ones, so handlers
 * always see typed, sanitized data (unknown keys are stripped by zod objects).
 */
export function validate(schemas: Schemas): RequestHandler {
  return (req, _res, next) => {
    for (const source of ['params', 'query', 'body'] as const) {
      const schema = schemas[source];
      if (!schema) continue;
      const result = schema.safeParse(req[source] ?? {});
      if (!result.success) throw new ValidationError('Validation failed', toErrors(result.error, source));
      // Express 5 exposes req.query as a getter; redefine it to hold the parsed value.
      Object.defineProperty(req, source, { value: result.data, writable: true, configurable: true, enumerable: true });
    }
    next();
  };
}
