import { LayoutDashboard, User } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { ROLE_LABELS } from '../constants/roles';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';

export default function Dashboard() {
  const user = useAuthStore((s) => s.user);
  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-2">
        <LayoutDashboard className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
      </div>
      <Card className="max-w-md animate-fade-up">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5 text-muted-foreground" />
            Welcome back
          </CardTitle>
          <CardDescription>
            {user?.username ? (
              <>Signed in as <span className="font-medium text-foreground">{user.username}</span></>
            ) : (
              'You are signed in.'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Role</span>
            <Badge variant="secondary">{user?.role ? ROLE_LABELS[user.role] ?? user.role : '—'}</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
