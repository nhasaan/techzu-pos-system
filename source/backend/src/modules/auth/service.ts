import { config } from '../../shared/config';
import { db } from '../../shared/db';
import { UnauthorizedError } from '../../shared/utils/errors';
import { issueTokenPair, verifyToken, type SessionSubject } from '../../shared/utils/jwt';
import { logger } from '../../shared/utils/logger';
import { cacheSet, isRedisReady, redis } from '../../shared/utils/redis';
import { hashPassword, needsRehash, verifyPassword } from '../../shared/utils/password';
import { authRepository } from './repository';

const blacklistKey = (jti: string) => `bl:${jti}`;

/**
 * Two browser tabs (or a retried request) can present the same refresh token within moments of
 * each other. Inside this window the loser just gets a 401 instead of triggering reuse detection,
 * which would otherwise log the user out everywhere, including the session the winner just got.
 */
const REFRESH_RACE_GRACE_MS = 10_000;

// Verifying against a real hash when the user does not exist keeps response time constant,
// so login timing cannot be used to enumerate usernames.
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= hashPassword('timing-equaliser-not-a-real-password'));

const toSubject = (u: { id: number; username: string; role: SessionSubject['role']; outletId: number | null }) => ({
  id: u.id,
  username: u.username,
  role: u.role,
  outletId: u.outletId,
});

async function startSession(user: SessionSubject) {
  const pair = issueTokenPair(user);
  const expiresAt = new Date(Date.now() + config.tokens.refreshTtlSec * 1000);
  return { pair, expiresAt };
}

export async function login(username: string, password: string) {
  const user = await authRepository.findUserByUsername(username);
  const valid = await verifyPassword(user?.passwordHash ?? (await getDummyHash()), password);
  if (!user || !valid) throw new UnauthorizedError('Invalid credentials', { credentials: 'Invalid credentials' });
  if (needsRehash(user.passwordHash)) {
    // Transparently upgrade hashes made with older parameters (we have the plaintext only now).
    hashPassword(password)
      .then((hash) => authRepository.updatePasswordHash(user.id, hash))
      .catch((err) => logger.warn({ err, userId: user.id }, 'Password rehash failed'));
  }

  const { pair, expiresAt } = await startSession(toSubject(user));
  await authRepository.insertSession(db, user.id, pair.jti, expiresAt);
  // Best effort; a failure here must not fail the login.
  authRepository.deleteExpiredSessions(user.id).catch((err) => logger.warn({ err }, 'Expired session cleanup failed'));
  return { accessToken: pair.accessToken, refreshToken: pair.refreshToken };
}

/**
 * Refresh-token rotation with reuse detection: each refresh token works once. Presenting an
 * already-consumed token means it was stolen or replayed, so every session of that user is revoked.
 */
export async function refresh(refreshToken: string) {
  const claims = verifyToken(refreshToken, 'refresh');
  if (!claims) throw new UnauthorizedError('Invalid refresh token', { token: 'Invalid refresh token' });

  const result = await db.transaction(async (tx) => {
    const consumed = await authRepository.consumeActiveSession(tx, claims.jti);
    if (!consumed) return null;
    // Re-read the user so role / outlet changes (or deletion) take effect on refresh.
    const user = await authRepository.findUserById(tx, consumed.userId);
    if (!user) return null;
    const { pair, expiresAt } = await startSession(toSubject(user));
    await authRepository.insertSession(tx, user.id, pair.jti, expiresAt);
    return pair;
  });
  if (result) return { accessToken: result.accessToken, refreshToken: result.refreshToken };

  const session = await authRepository.findSessionByJti(claims.jti);
  if (session?.status === 'consumed' && session.consumedAt && Date.now() - session.consumedAt.getTime() < REFRESH_RACE_GRACE_MS) {
    throw new UnauthorizedError('Refresh token already used', { token: 'Already used' });
  }
  if (session?.status === 'consumed') {
    const jtis = await authRepository.revokeAllSessions(session.userId);
    await Promise.all(jtis.map((jti) => blacklist(jti, config.tokens.accessTtlSec)));
    logger.warn({ userId: session.userId }, 'Refresh token reuse detected; all sessions revoked');
    throw new UnauthorizedError('Token reuse detected. All sessions revoked.', { token: 'Reused' });
  }
  if (session?.status === 'revoked') throw new UnauthorizedError('Token revoked', { token: 'Revoked' });
  throw new UnauthorizedError('Invalid refresh token', { token: 'Invalid refresh token' });
}

export async function logout(jti: string, accessExp: number) {
  const ttl = Math.max(1, accessExp - Math.floor(Date.now() / 1000));
  await blacklist(jti, ttl);
  await authRepository.revokeSession(jti);
}

async function blacklist(jti: string, ttlSec: number) {
  const ok = await cacheSet(blacklistKey(jti), '1', ttlSec);
  if (!ok) logger.warn({ jti }, 'Could not write token blacklist to Redis; relying on DB revocation');
}

/**
 * Hot path (every authenticated request). Redis answers when available; if Redis is down we
 * fall back to the sessions table so logout / revocation is still enforced.
 */
export async function isSessionRevoked(jti: string): Promise<boolean> {
  if (isRedisReady()) {
    try {
      const [hit, loaded] = await redis.mget(blacklistKey(jti), BLACKLIST_LOADED_KEY);
      if (hit !== null) return true;
      // The marker disappears whenever Redis loses its data (restart without persistence, flush,
      // eviction). Without it a cache miss proves nothing, so fall through to the database.
      if (loaded !== null) return false;
      void rebuildBlacklist();
    } catch {
      // fall through to the database
    }
  }
  const session = await authRepository.findSessionByJti(jti);
  return session?.status === 'revoked';
}

const BLACKLIST_LOADED_KEY = 'bl:__loaded';
let rebuilding: Promise<void> | null = null;

/**
 * Re-populates the Redis blacklist from the sessions table (only sessions revoked within the
 * access-token lifetime matter), then sets the marker that lets cache misses be trusted again.
 */
export function rebuildBlacklist(): Promise<void> {
  rebuilding ??= (async () => {
    try {
      const ttlMs = config.tokens.accessTtlSec * 1000;
      const rows = await authRepository.findRecentlyRevoked(new Date(Date.now() - ttlMs));
      const pipeline = redis.pipeline();
      for (const { jti, revokedAt } of rows) {
        const remainingSec = Math.ceil((revokedAt!.getTime() + ttlMs - Date.now()) / 1000);
        if (remainingSec > 0) pipeline.set(blacklistKey(jti), '1', 'EX', remainingSec);
      }
      pipeline.set(BLACKLIST_LOADED_KEY, new Date().toISOString());
      await pipeline.exec();
      logger.info({ entries: rows.length }, 'Token blacklist rebuilt in Redis');
    } catch (err) {
      logger.warn({ err }, 'Could not rebuild token blacklist; database fallback stays active');
    } finally {
      rebuilding = null;
    }
  })();
  return rebuilding;
}
