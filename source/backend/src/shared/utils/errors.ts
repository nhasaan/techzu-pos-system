import type { ApiErrors } from './response';

/** Operational error with an HTTP status. Thrown from services/controllers, rendered by the error middleware. */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly errors: ApiErrors = null,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', errors: ApiErrors = null) {
    super(400, message, errors);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', errors: ApiErrors = { token: 'Invalid' }) {
    super(401, message, errors);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied.', errors: ApiErrors = { role: 'Forbidden' }) {
    super(403, message, errors);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found', errors: ApiErrors = null) {
    super(404, message, errors);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict', errors: ApiErrors = null) {
    super(409, message, errors);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', errors: ApiErrors = null) {
    super(422, message, errors);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable', errors: ApiErrors = { database: 'Unavailable' }) {
    super(503, message, errors);
  }
}
