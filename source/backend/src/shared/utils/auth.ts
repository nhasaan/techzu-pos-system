import type { Request, RequestHandler } from 'express';
import { ROLE_HQ, ROLE_OUTLET, ROLE_SUPERADMIN, type UserRole } from '../db/schema';
import { ForbiddenError, UnauthorizedError } from './errors';
import { verifyToken } from './jwt';
import { isSessionRevoked } from '../../modules/auth/service';

export interface AuthUser {
  userId: number;
  username: string;
  role: UserRole;
  outletId: number | null;
  jti: string;
  exp: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

/**
 * Verifies the JWT first (pure CPU, no I/O), and only then checks revocation — so forged or
 * expired tokens never cost a Redis/DB round trip.
 */
export const authenticate: RequestHandler = async (req, _res, next) => {
  const token = bearerToken(req);
  if (!token) throw new UnauthorizedError('No token provided', { authorization: 'Missing or invalid' });

  const claims = verifyToken(token, 'access');
  if (!claims) throw new UnauthorizedError('Invalid or expired token', { token: 'Invalid' });

  if (await isSessionRevoked(claims.jti)) {
    throw new UnauthorizedError('Token invalidated (logged out)', { token: 'Revoked' });
  }

  req.user = {
    userId: Number(claims.userId),
    username: claims.username,
    role: claims.role,
    outletId: claims.outletId != null ? Number(claims.outletId) : null,
    jti: claims.jti,
    exp: claims.exp,
  };
  next();
};

export function requireRoles(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new ForbiddenError(`Access denied. ${roles.join(' or ')} role required.`);
    }
    next();
  };
}

export const requireHQOrSuperadmin = requireRoles(ROLE_HQ, ROLE_SUPERADMIN);
export const requireSuperadmin = requireRoles(ROLE_SUPERADMIN);

/** The authenticated user (routes using this are always behind `authenticate`). */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw new UnauthorizedError('No token provided', { authorization: 'Missing or invalid' });
  return req.user;
}

export const isOutletUser = (user: AuthUser) => user.role === ROLE_OUTLET;

/** Outlet admins may only touch their own outlet; HQ and superadmin may access any outlet. */
export function assertOutletAccess(user: AuthUser, outletId: number): void {
  if (isOutletUser(user) && user.outletId !== outletId) {
    throw new ForbiddenError('Access denied. Outlet context required.');
  }
}
