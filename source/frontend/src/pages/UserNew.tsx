import { fetchAllPages } from '../lib/pagination';
import { useNavigate, Link } from 'react-router-dom';
import { Users as UsersIcon, ArrowLeft } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createUser } from '../api/users';
import RequireSuperadmin from '../components/RequireSuperadmin';
import { listOutlets } from '../api/outlets';
import { ApiError } from '../lib/api';
import { useToastStore } from '../store/toast';
import { Button, buttonVariants } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { cn } from '../lib/utils';
import { ROLE_HQ, ROLE_LABELS, ROLE_OUTLET, USER_ROLES } from '../constants/roles';

const schema = z.object({
  username: z.string().trim().min(1, 'Username is required').regex(/^[A-Za-z0-9._-]+$/, 'Only letters, digits, dot, underscore and dash'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(USER_ROLES),
  // 0 = "Select outlet" placeholder; only validated for outlet admins.
  outletId: z.number().int().nonnegative().optional(),
}).refine((d) => d.role !== ROLE_OUTLET || (d.outletId != null && d.outletId > 0), {
  message: 'Outlet is required for outlet admins',
  path: ['outletId'],
});

type FormValues = z.infer<typeof schema>;

function UserNewContent() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  const { register, control, handleSubmit, setError, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { username: '', password: '', role: ROLE_HQ, outletId: undefined },
  });

  const role = useWatch({ control, name: 'role' });

  const { data: outletsData } = useQuery({
    queryKey: ['outlets', 'all'],
    queryFn: () => fetchAllPages(listOutlets),
  });

  const mutation = useMutation({
    // Only outlet admins are bound to an outlet; drop a stale selection for other roles.
    mutationFn: ({ outletId, ...rest }: FormValues) => createUser({ ...rest, ...(rest.role === ROLE_OUTLET ? { outletId } : {}) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      addToast('User created', 'success');
      navigate('/users', { replace: true });
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        if (err.status === 409) setError('username', { message: 'Username already exists' });
        else if (err.errors) {
          const k = Object.keys(err.errors)[0];
          if (k) setError('root', { message: err.errors[k] });
          else setError('root', { message: err.message });
        } else setError('root', { message: err.message });
      } else setError('root', { message: err instanceof Error ? err.message : 'Create failed' });
    },
  });

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-2">
        <UsersIcon className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Add user</h1>
      </div>
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>New user</CardTitle>
          <CardDescription>Create a user. Superadmin only.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit((d) => mutation.mutate({ ...d, outletId: d.outletId }))} className="space-y-4">
            {errors.root && <p className="text-sm text-destructive" role="alert">{errors.root.message}</p>}
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" {...register('username')} placeholder="Username" />
              {errors.username && <p className="text-sm text-destructive">{errors.username.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" {...register('password')} placeholder="Min 8 characters" />
              {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <select id="role" {...register('role')} className={cn('flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm')}>
                {USER_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
            {role === ROLE_OUTLET && (
              <div className="space-y-2">
                <Label htmlFor="outletId">Outlet</Label>
                <select id="outletId" {...register('outletId', { valueAsNumber: true })} className={cn('flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm')}>
                  <option value={0}>Select outlet</option>
                  {(outletsData?.items ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
                {errors.outletId && <p className="text-sm text-destructive">{errors.outletId.message}</p>}
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Link to="/users" className={cn(buttonVariants({ variant: 'outline' }), 'gap-2 inline-flex')}>
                <ArrowLeft className="h-4 w-4" />
                Cancel
              </Link>
              <Button type="submit" disabled={mutation.isPending}>Create user</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function UserNew() {
  return (
    <RequireSuperadmin>
      <UserNewContent />
    </RequireSuperadmin>
  );
}
