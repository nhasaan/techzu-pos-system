import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { ROLE_SUPERADMIN } from '../constants/roles';

export default function RequireSuperadmin({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (user?.role !== ROLE_SUPERADMIN) return <Navigate to="/" replace />;
  return <>{children}</>;
}
