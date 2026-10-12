import { useState } from 'react';
import { Package, Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth';
import { useOutletStore } from '../store/outlet';
import Pagination from '../components/Pagination';
import { usePageForOutlet } from '../lib/usePageForOutlet';
import { listInventoryByOutlet, setStock, type InventoryRow } from '../api/inventory';
import { listMenuByOutlet } from '../api/menu';
import { ApiError } from '../lib/api';
import { useToastStore } from '../store/toast';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { cn } from '../lib/utils';
import { ROLE_OUTLET } from '../constants/roles';

const setStockSchema = z.object({
  menuItemId: z.number().int().min(1, 'Select a menu item'),
  stock: z.number().int().min(0, 'Stock must be ≥ 0'),
});

type SetStockForm = z.infer<typeof setStockSchema>;

const PAGE_SIZE = 20;

export default function Inventory() {
  const user = useAuthStore((s) => s.user);
  const selectedOutletId = useOutletStore((s) => s.selectedOutletId);
  const outletId = user?.role === ROLE_OUTLET ? user?.outletId ?? null : selectedOutletId;
  const [page, setPage] = usePageForOutlet(outletId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['inventory', outletId, page, PAGE_SIZE],
    queryFn: () => listInventoryByOutlet(outletId!, { page, limit: PAGE_SIZE }),
    enabled: outletId != null,
  });

  const { data: menuData } = useQuery({
    queryKey: ['menu', 'outlet', outletId, 1, 100],
    queryFn: () => listMenuByOutlet(outletId!, { page: 1, limit: 100 }),
    enabled: outletId != null,
  });

  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm<SetStockForm>({
    resolver: zodResolver(setStockSchema),
    defaultValues: { menuItemId: 0, stock: 0 },
  });

  const addToast = useToastStore((s) => s.addToast);
  const setStockMutation = useMutation({
    mutationFn: (body: SetStockForm) => setStock({ ...body, outletId: outletId! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      reset();
      setDialogOpen(false);
      addToast('Stock updated', 'success');
    },
    onError: (err) => {
      if (err instanceof ApiError && err.errors) {
        const k = Object.keys(err.errors)[0];
        if (k) setError('root', { message: err.errors[k] });
        else setError('root', { message: err.message });
      } else setError('root', { message: err instanceof Error ? err.message : 'Set stock failed' });
    },
  });

  if (user?.role !== ROLE_OUTLET && outletId == null) {
    return (
      <div className="p-6">
        <div className="mb-6 flex items-center gap-2">
          <Package className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Inventory</h1>
        </div>
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Select an outlet from the sidebar to view inventory.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const menuItems = menuData?.items ?? [];
  const getMenuItemName = (id: number) => menuItems.find((m) => m.id === id)?.name ?? String(id);
  const rowItemName = (row: InventoryRow) => row.itemName ?? getMenuItemName(row.menuItemId);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Inventory</h1>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Set stock
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stock by outlet</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>}
          {isError && <p className="py-8 text-center text-sm text-destructive">Failed to load inventory.</p>}
          {data && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Menu item</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                        No inventory yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.items.map((row: InventoryRow) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{rowItemName(row)}</TableCell>
                        <TableCell className="text-muted-foreground">{row.stock}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.updatedAt ? new Date(row.updatedAt).toLocaleString() : '—'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>

      {dialogOpen && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/50" onClick={() => setDialogOpen(false)}>
          <div className="rounded-lg border border-border bg-card p-6 shadow-lg w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-foreground mb-4">Set stock</h2>
            <form onSubmit={handleSubmit((d) => setStockMutation.mutate(d))} className="space-y-4">
              {errors.root && <p className="text-sm text-destructive" role="alert">{errors.root.message}</p>}
              <div className="space-y-2">
                <Label>Menu item</Label>
                <select {...register('menuItemId', { valueAsNumber: true })} className={cn('flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm')}>
                  <option value={0}>Select</option>
                  {menuItems.map((m) => <option key={m.id} value={m.id}>{m.name ?? m.id}</option>)}
                </select>
                {errors.menuItemId && <p className="text-sm text-destructive">{errors.menuItemId.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Stock</Label>
                <Input type="number" min={0} {...register('stock', { valueAsNumber: true })} />
                {errors.stock && <p className="text-sm text-destructive">{errors.stock.message}</p>}
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={setStockMutation.isPending}>Save</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
