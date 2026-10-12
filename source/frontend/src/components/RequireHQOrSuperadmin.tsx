import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { ROLE_HQ, ROLE_SUPERADMIN } from '../constants/roles';

export default function RequireHQOrSuperadmin({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const allowed = user?.role === ROLE_HQ || user?.role === ROLE_SUPERADMIN;
  if (!allowed) return <Navigate to="/" replace />;
  return <>{children}</>;
}
