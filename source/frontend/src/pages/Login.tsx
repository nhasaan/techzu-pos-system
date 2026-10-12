import { LogIn } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { login as loginApi, ApiError } from '../api/auth';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const { register, handleSubmit, setError, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  });

  const mutation = useMutation({
    mutationFn: (data: LoginForm) => loginApi(data.username, data.password),
    onSuccess: (data, variables) => {
      setAuth({ username: variables.username, accessToken: data.accessToken, refreshToken: data.refreshToken });
      navigate('/', { replace: true });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.errors) {
        const key = Object.keys(err.errors)[0];
        if (key) setError('root', { message: err.errors[key] });
        else setError('root', { message: err.message });
      } else setError('root', { message: err instanceof Error ? err.message : 'Login failed' });
    },
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm border-border shadow-lg animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-3 duration-500 ease-out-expo">
        <CardHeader className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-2xl">
            <LogIn className="h-6 w-6 text-primary" />
            Sign in
          </CardTitle>
          <CardDescription>Enter your credentials to access the POS dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            {errors.root && (
              <p className="text-sm text-destructive animate-in fade-in-0 slide-in-from-top-1 duration-200" role="alert">
                {errors.root.message}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                autoComplete="username"
                placeholder="Username"
                {...register('username')}
              />
              {errors.username && (
                <p className="text-sm text-destructive">{errors.username.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Password"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full" loading={mutation.isPending}>
              {mutation.isPending ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
