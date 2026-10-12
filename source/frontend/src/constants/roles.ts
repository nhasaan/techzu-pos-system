// Must match the backend's user_role enum (hqadmin | outletadmin | superadmin).
// The original app used 'hq' / 'outlet' here, so HQ admins lost their navigation,
// outlet admins were never scoped to their outlet, and creating HQ/outlet users failed with 422.
export const USER_ROLES = ['hqadmin', 'outletadmin', 'superadmin'] as const;
export type UserRole = (typeof USER_ROLES)[number];
export const ROLE_HQ = 'hqadmin' as const;
export const ROLE_OUTLET = 'outletadmin' as const;
export const ROLE_SUPERADMIN = 'superadmin' as const;

export const ROLE_LABELS: Record<UserRole, string> = {
  hqadmin: 'HQ admin',
  outletadmin: 'Outlet admin',
  superadmin: 'Superadmin',
};
