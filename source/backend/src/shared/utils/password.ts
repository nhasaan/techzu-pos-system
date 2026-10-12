import argon2 from 'argon2';
import { Semaphore } from './semaphore';

/**
 * argon2id with the OWASP-recommended minimum (19 MiB, 2 iterations, 1 lane).
 * The library default (64 MiB, t=3, p=4) used ~190 MB of native memory for four concurrent logins,
 * enough to OOM a 512 MB instance during a shift-change login burst, and was ~4x slower.
 */
export const ARGON2_OPTIONS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

// Hashing runs on libuv's thread pool, which zlib and DNS also use. Two at a time bounds memory and
// keeps compression/DNS responsive; extra logins wait briefly instead of all hashing at once.
const hashing = new Semaphore(2);

export const hashPassword = (plain: string) => hashing.run(() => argon2.hash(plain, ARGON2_OPTIONS));

export const verifyPassword = (hash: string, plain: string) =>
  hashing.run(() => argon2.verify(hash, plain)).catch(() => false);

/** True for hashes created with older/weaker parameters; they are upgraded on the next login. */
export const needsRehash = (hash: string) => argon2.needsRehash(hash, ARGON2_OPTIONS);
