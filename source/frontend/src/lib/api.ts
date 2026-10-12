import { uuid } from './utils';
const getBaseUrl = () => import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
const API_PREFIX = 'api';

let getAccessToken: (() => string | null) | null = null;
let getRefreshToken: (() => string | null) | null = null;
let setTokens: ((accessToken: string, refreshToken: string) => void) | null = null;
let onSessionExpired: (() => void) | null = null;
let reloadTokens: (() => Promise<void>) | null = null;

export function setAuthTokenGetter(fn: () => string | null) {
  getAccessToken = fn;
}

export function setRefreshTokenGetter(fn: () => string | null) {
  getRefreshToken = fn;
}

export function setTokensUpdater(fn: (accessToken: string, refreshToken: string) => void) {
  setTokens = fn;
}

export function setSessionExpiredHandler(fn: () => void) {
  onSessionExpired = fn;
}

/** Re-reads persisted tokens (another tab may have rotated them). */
export function setTokensReloader(fn: () => Promise<void>) {
  reloadTokens = fn;
}

/**
 * Another tab refreshed with the same refresh token a moment earlier: the server answers 401
 * "Already used" to us. Wait briefly for that tab's new tokens to land in shared storage and adopt
 * them instead of logging the user out of every tab.
 */
async function adoptTokensFromOtherTab(usedToken: string): Promise<boolean> {
  for (let i = 0; i < 10; i++) {
    await reloadTokens?.();
    const latest = getRefreshToken?.() ?? null;
    if (latest && latest !== usedToken) return true;
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
}

interface RefreshPayload {
  accessToken: string;
  refreshToken: string;
}

async function doRefresh(refreshTokenValue: string): Promise<RefreshPayload> {
  const base = getBaseUrl().replace(/\/$/, '');
  const url = `${base}/${API_PREFIX}/auth/refresh`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-request-id': uuid() },
    body: JSON.stringify({ refreshToken: refreshTokenValue }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data?.message ?? res.statusText, data?.errors);
  const payload = (data?.data ?? data) as RefreshPayload;
  if (!payload?.accessToken || !payload?.refreshToken) throw new Error('Invalid refresh response');
  return payload;
}

let refreshPromise: Promise<boolean> | null = null;

function attemptRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  const token = getRefreshToken?.() ?? null;
  if (!token) {
    onSessionExpired?.();
    return Promise.resolve(false);
  }
  refreshPromise = doRefresh(token)
    .then((payload) => {
      setTokens?.(payload.accessToken, payload.refreshToken);
      return true;
    })
    .catch(async (err) => {
      if (err instanceof ApiError && err.errors?.token === 'Already used' && (await adoptTokensFromOtherTab(token))) return true;
      onSessionExpired?.();
      return false;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

function authPath(path: string): 'login' | 'refresh' | null {
  const p = path.replace(/^\//, '').split('?')[0];
  if (p === 'auth/login') return 'login';
  if (p === 'auth/refresh') return 'refresh';
  return null;
}

async function request<T>(path: string, url: string, init: RequestInit): Promise<T> {
  const token = getAccessToken?.() ?? null;
  const headers: HeadersInit = {
    ...(init.headers as Record<string, string>),
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'x-request-id': uuid(),
  };
  const res = await fetch(url, { ...init, headers });
  const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
  if (res.ok) return (data?.data ?? data) as T;
  const kind = authPath(path);
  // A 401 from login means wrong credentials: surface the error instead of trying to refresh
  // (previously this redirected to /login and swallowed the message).
  if (res.status === 401 && kind === null) {
    const ok = await attemptRefresh();
    if (ok) return request<T>(path, url, init);
  } else if (res.status === 401 && kind === 'refresh') {
    onSessionExpired?.();
  }
  throw new ApiError(res.status, data?.message ?? res.statusText, data?.errors);
}

export async function api<T>(
  path: string,
  init?: RequestInit & { params?: Record<string, string | number> }
): Promise<T> {
  const { params, ...rest } = init ?? {};
  const base = getBaseUrl().replace(/\/$/, '');
  const pathStr = path.replace(/^\//, '');
  let url = `${base}/${API_PREFIX}/${pathStr}`;
  if (params && Object.keys(params).length > 0) {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => search.set(k, String(v)));
    url += `?${search.toString()}`;
  }
  return request<T>(path, url, { ...rest });
}

export class ApiError extends Error {
  status: number;
  errors?: Record<string, string>;
  constructor(status: number, message: string, errors?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}
