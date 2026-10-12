import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import type { UserRole } from '../db/schema';

export type TokenType = 'access' | 'refresh';

/** Claims shared by access and refresh tokens. ids are strings in the token (JSON-safe). */
export interface TokenClaims {
  sub: string;
  userId: string;
  username: string;
  role: UserRole;
  outletId?: string;
  /** Session id: shared by the access/refresh pair, rotated on refresh. */
  jti: string;
  typ: TokenType;
}

export interface VerifiedToken extends TokenClaims {
  exp: number;
  iat: number;
}

const ISSUER = 'pos-backend';
const AUDIENCE = 'pos-api';

export interface SessionSubject {
  id: number;
  username: string;
  role: UserRole;
  outletId: number | null;
}

export function issueTokenPair(user: SessionSubject) {
  const jti = randomUUID();
  const base = {
    sub: String(user.id),
    userId: String(user.id),
    username: user.username,
    role: user.role,
    ...(user.outletId != null ? { outletId: String(user.outletId) } : {}),
    jti,
  };
  const sign = (typ: TokenType, expiresIn: number) =>
    jwt.sign({ ...base, typ }, config.jwt.signKey, {
      algorithm: config.jwt.algorithm,
      expiresIn,
      issuer: ISSUER,
      audience: AUDIENCE,
    });
  return {
    jti,
    accessToken: sign('access', config.tokens.accessTtlSec),
    refreshToken: sign('refresh', config.tokens.refreshTtlSec),
  };
}

/**
 * Verifies signature, expiry, issuer, audience and token type. A refresh token can never be
 * used as an access token (and vice versa) — the type claim is enforced.
 */
export function verifyToken(token: string, expected: TokenType): VerifiedToken | null {
  try {
    const decoded = jwt.verify(token, config.jwt.verifyKey, {
      algorithms: [config.jwt.algorithm],
      issuer: ISSUER,
      audience: AUDIENCE,
    }) as VerifiedToken;
    if (decoded.typ !== expected || !decoded.jti || !decoded.sub) return null;
    return decoded;
  } catch {
    return null;
  }
}
