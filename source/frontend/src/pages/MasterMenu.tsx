import { useState } from 'react';
import { TableSkeleton } from '../components/ui/skeleton';
import { rowEnter } from '../lib/motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, keepPreviousData, useQueryClient } from '@tanstack/react-query';
import { UtensilsCrossed, Plus, Link2 } from 'lucide-react';
import RequireHQOrSuperadmin from '../components/RequireHQOrSuperadmin';
import Pagination from '../components/Pagination';
import { fetchAllPages, useCursorPager } from '../lib/pagination';
import { listMasterMenu, createMenuItem, assignToOutlet, type MenuItem } from '../api/menu';
import { listOutlets } from '../api/outlets';
import { ApiError } from '../lib/api';
import { useToastStore } from '../store/toast';
import { Dialog } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { cn } from '../lib/utils';

const createSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  basePrice: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid price (e.g. 10.50)'),
  description: z.string().optional(),
});

const assignSchema = z.object({
  outletId: z.number().int().min(1, 'Select an outlet'),
  menuItemId: z.number().int().min(1, 'Select a menu item'),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/).optional().or(z.literal('')),
  isActive: z.boolean().optional(),
});

type CreateForm = z.infer<typeof createSchema>;
type AssignForm = z.infer<typeof assignSchema>;

const PAGE_SIZE = 20;

function MasterMenuContent() {
  const pager = useCursorPager(null);
  const [addOpen, setAddOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, isPlaceholderData } = useQuery({
    queryKey: ['menu', 'master', pager.cursor, PAGE_SIZE],
    queryFn: () => listMasterMenu({ cursor: pager.cursor, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const { data: outletsData } = useQuery({
    queryKey: ['outlets', 'all'],
    queryFn: () => fetchAllPages(listOutlets),
  });

  const { data: allMenuData } = useQuery({
    queryKey: ['menu', 'master', 'all'],
    queryFn: () => fetchAllPages(listMasterMenu),
    enabled: assignOpen,
  });

  const { register: regCreate, handleSubmit: handleCreateSubmit, reset: resetCreate, setError: setCreateError, formState: { errors: createErrors } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: '', basePrice: '', description: '' },
  });

  const { register: regAssign, handleSubmit: handleAssignSubmit, reset: resetAssign, setError: setAssignError, formState: { errors: assignErrors } } = useForm<AssignForm>({
    resolver: zodResolver(assignSchema),
    defaultValues: { outletId: 0, menuItemId: 0, price: '', isActive: true },
  });

  const addToast = useToastStore((s) => s.addToast);
  const createMutation = useMutation({
    mutationFn: createMenuItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu'] });
      resetCreate();
      setAddOpen(false);
      addToast('Menu item created', 'success');
    },
    onError: (err) => {
      if (err instanceof ApiError && err.errors) {
        const k = Object.keys(err.errors)[0];
        if (k) setCreateError('root', { message: err.errors[k] });
        else setCreateError('root', { message: err.message });
      } else setCreateError('root', { message: err instanceof Error ? err.message : 'Create failed' });
    },
  });

  const assignMutation = useMutation({
    mutationFn: assignToOutlet,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu'] });
      resetAssign();
      setAssignOpen(false);
      addToast('Assigned to outlet', 'success');
    },
    onError: (err) => {
      if (err instanceof ApiError && err.errors) {
        const k = Object.keys(err.errors)[0];
        if (k) setAssignError('root', { message: err.errors[k] });
        else setAssignError('root', { message: err.message });
      } else setAssignError('root', { message: err instanceof Error ? err.message : 'Assign failed' });
    },
  });

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UtensilsCrossed className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Master menu</h1>
        </div>
        <div className="flex gap-2">
          <Button type="button" onClick={() => setAddOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add item
          </Button>
          <Button type="button" variant="outline" onClick={() => setAssignOpen(true)} className="gap-2">
            <Link2 className="h-4 w-4" />
            Assign to outlet
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Master menu items</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <TableSkeleton cols={4} />}
          {isError && <p className="py-8 text-center text-sm text-destructive">Failed to load.</p>}
          {data && (
            <>
              <Table className={cn('transition-opacity duration-200', isPlaceholderData && 'opacity-60')}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Base price</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">No items yet.</TableCell>
                    </TableRow>
                  ) : (
                    data.items.map((row: MenuItem, i) => (
                      <TableRow key={row.id} {...rowEnter(i)}>
                        <TableCell className="font-medium">{row.name ?? '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{row.basePrice}</TableCell>
                        <TableCell className="text-muted-foreground">{row.description ?? '—'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <Pagination pageNumber={pager.pageNumber} hasPrev={pager.hasPrev} hasNext={data.hasMore} onPrev={pager.prev} onNext={() => pager.next(data.nextCursor)} />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} title="Add menu item">
      <form onSubmit={handleCreateSubmit((d) => createMutation.mutate(d))} className="space-y-4">
        {createErrors.root && <p className="text-sm text-destructive animate-in fade-in-0 slide-in-from-top-1 duration-200" role="alert">{createErrors.root.message}</p>}
        <div className="space-y-2">
          <Label htmlFor="create-name">Name</Label>
          <Input id="create-name" {...regCreate('name')} placeholder="Item name" />
          {createErrors.name && <p className="text-sm text-destructive">{createErrors.name.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="create-basePrice">Base price</Label>
          <Input id="create-basePrice" {...regCreate('basePrice')} placeholder="e.g. 10.50" />
          {createErrors.basePrice && <p className="text-sm text-destructive">{createErrors.basePrice.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="create-description">Description</Label>
          <Input id="create-description" {...regCreate('description')} placeholder="Optional" />
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button type="submit" loading={createMutation.isPending}>Create</Button>
        </div>
      </form>
      </Dialog>

      <Dialog open={assignOpen} onClose={() => setAssignOpen(false)} title="Assign to outlet">
      <form onSubmit={handleAssignSubmit((d) => assignMutation.mutate({ outletId: d.outletId, menuItemId: d.menuItemId, price: d.price || undefined, isActive: d.isActive }))} className="space-y-4">
        {assignErrors.root && <p className="text-sm text-destructive animate-in fade-in-0 slide-in-from-top-1 duration-200" role="alert">{assignErrors.root.message}</p>}
        <div className="space-y-2">
          <Label htmlFor="assign-outletId">Outlet</Label>
          <select id="assign-outletId" {...regAssign('outletId', { valueAsNumber: true })} className={cn('flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground')}>
            <option value={0}>Select</option>
            {outletsData?.items?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          {assignErrors.outletId && <p className="text-sm text-destructive">{assignErrors.outletId.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="assign-menuItemId">Menu item</Label>
          <select id="assign-menuItemId" {...regAssign('menuItemId', { valueAsNumber: true })} className={cn('flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground')}>
            <option value={0}>Select</option>
            {(allMenuData?.items ?? data?.items ?? []).map((m) => <option key={m.id} value={m.id}>{m.name} ({m.basePrice})</option>)}
          </select>
          {assignErrors.menuItemId && <p className="text-sm text-destructive">{assignErrors.menuItemId.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="assign-price">Price override (optional)</Label>
          <Input id="assign-price" {...regAssign('price')} placeholder="e.g. 12.00" />
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="assign-active" {...regAssign('isActive')} className="rounded border-input" />
          <Label htmlFor="assign-active" className="font-normal cursor-pointer">Active</Label>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
          <Button type="submit" loading={assignMutation.isPending}>Assign</Button>
        </div>
      </form>
      </Dialog>
    </div>
  );
}

export default function MasterMenu() {
  return (
    <RequireHQOrSuperadmin>
      <MasterMenuContent />
    </RequireHQOrSuperadmin>
  );
}
