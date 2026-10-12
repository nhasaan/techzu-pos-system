import { useNavigate, Link } from 'react-router-dom';
import { Store, ArrowLeft } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import RequireHQOrSuperadmin from '../components/RequireHQOrSuperadmin';
import { createOutlet } from '../api/outlets';
import { ApiError } from '../api/auth';
import { useToastStore } from '../store/toast';
import { Button, buttonVariants } from '../components/ui/button';
import { cn } from '../lib/utils';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  address: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function OutletNewContent() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  const { register, handleSubmit, setError, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', address: '' },
  });

  const mutation = useMutation({
    mutationFn: createOutlet,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outlets'] });
      addToast('Outlet created', 'success');
      navigate('/outlets', { replace: true });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.errors) {
        const k = Object.keys(err.errors)[0];
        if (k) setError('root', { message: err.errors[k] });
        else setError('root', { message: err.message });
      } else setError('root', { message: err instanceof Error ? err.message : 'Create failed' });
    },
  });

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-2">
        <Store className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Add outlet</h1>
      </div>
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>New outlet</CardTitle>
          <CardDescription>Create a new outlet. HQ or superadmin only.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            {errors.root && (
              <p className="text-sm text-destructive animate-in fade-in-0 slide-in-from-top-1 duration-200" role="alert">
                {errors.root.message}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="outlet-name">Name</Label>
              <Input id="outlet-name" placeholder="Outlet name" {...register('name')} />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="outlet-address">Address (optional)</Label>
              <Input id="outlet-address" placeholder="Address" {...register('address')} />
            </div>
            <div className="flex gap-2 pt-2">
              <Link to="/outlets" className={cn(buttonVariants({ variant: 'outline' }), 'gap-2 inline-flex')}>
                  <ArrowLeft className="h-4 w-4" />
                  Cancel
                </Link>
              <Button type="submit" loading={mutation.isPending}>
                Create outlet
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function OutletNew() {
  return (
    <RequireHQOrSuperadmin>
      <OutletNewContent />
    </RequireHQOrSuperadmin>
  );
}
