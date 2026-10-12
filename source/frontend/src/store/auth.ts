import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserRole } from '../constants/roles';
import { ROLE_OUTLET } from '../constants/roles';

export type { UserRole };

export interface AuthUser {
  id: number;
  username: string;
  role: UserRole;
  outletId: number | null;
}

export interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  setAuth: (payload: { username: string; accessToken: string; refreshToken: string }) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
}

interface TokenClaims {
  sub?: string;
  userId?: string;
  username?: string;
  role?: UserRole;
  outletId?: string;
}

function decodeJwtPayload(token: string): TokenClaims | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    // JWTs are base64url encoded.
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64)) as TokenClaims;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setAuth: (payload) => {
        const decoded = decodeJwtPayload(payload.accessToken);
        const user: AuthUser = decoded?.sub && decoded?.role
          ? {
              id: Number(decoded.sub),
              username: decoded.username ?? payload.username,
              role: decoded.role,
              outletId: decoded.outletId ? Number(decoded.outletId) : null,
            }
          : { id: 0, username: payload.username, role: ROLE_OUTLET, outletId: null };
        set({ user, accessToken: payload.accessToken, refreshToken: payload.refreshToken });
      },
      setTokens: (accessToken, refreshToken) => {
        const payload = decodeJwtPayload(accessToken);
        if (!payload?.sub || !payload?.role) return;
        const role = payload.role as UserRole;
        set((s) => ({
          accessToken,
          refreshToken,
          user: {
            id: Number(payload.sub),
            username: payload.username ?? s.user?.username ?? '',
            role,
            outletId: payload.outletId ? Number(payload.outletId) : null,
          },
        }));
      },
      clearAuth: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    {
      name: 'pos-auth',
      partialize: (s) => ({ accessToken: s.accessToken, refreshToken: s.refreshToken }),
      merge: (persisted, current) => {
        const p = persisted as { accessToken?: string; refreshToken?: string };
        const decoded = p.accessToken ? decodeJwtPayload(p.accessToken) : null;
        const role = decoded?.role;
        const user: AuthUser | null = decoded?.sub && role
          ? { id: Number(decoded.sub), username: decoded.username ?? '', role: role as UserRole, outletId: decoded.outletId ? Number(decoded.outletId) : null }
          : null;
        return { ...current, ...p, user };
      },
    }
  )
);
