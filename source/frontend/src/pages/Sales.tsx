import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { Receipt, Plus, FileText } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth';
import { useOutletStore } from '../store/outlet';
import Pagination from '../components/Pagination';
import { listSalesByOutlet, createSale, type Sale } from '../api/sales';
import { listMenuByOutlet } from '../api/menu';
import { ApiError } from '../lib/api';
import { useToastStore } from '../store/toast';
import { Button, buttonVariants } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { cn } from '../lib/utils';
import { ROLE_OUTLET } from '../constants/roles';

const lineSchema = z.object({
  menuItemId: z.number().int().min(1, 'Select item'),
  quantity: z.number().int().min(1, 'Min 1'),
});

const createSaleSchema = z.object({
  items: z.array(lineSchema).min(1, 'Add at least one item'),
}).refine((d) => d.items.every((i) => i.menuItemId > 0), { message: 'Select an item for each line', path: ['items'] });

type CreateSaleForm = z.infer<typeof createSaleSchema>;

const PAGE_SIZE = 20;

export default function Sales() {
  const user = useAuthStore((s) => s.user);
  const selectedOutletId = useOutletStore((s) => s.selectedOutletId);
  const outletId = user?.role === ROLE_OUTLET ? user?.outletId ?? null : selectedOutletId;
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  // One key per checkout attempt; rotated after a successful sale.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['sales', outletId, page, PAGE_SIZE],
    queryFn: () => listSalesByOutlet(outletId!, { page, limit: PAGE_SIZE }),
    enabled: outletId != null,
  });

  const { data: menuData } = useQuery({
    queryKey: ['menu', 'outlet', outletId, 1, 100],
    queryFn: () => listMenuByOutlet(outletId!, { page: 1, limit: 100 }),
    enabled: outletId != null && dialogOpen,
  });

  const { register, control, handleSubmit, reset, setError, formState: { errors } } = useForm<CreateSaleForm>({
    resolver: zodResolver(createSaleSchema),
    defaultValues: { items: [{ menuItemId: 0, quantity: 1 }] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const addToast = useToastStore((s) => s.addToast);
  const createMutation = useMutation({
    mutationFn: (form: CreateSaleForm) =>
      createSale(
        {
          ...(user?.role !== ROLE_OUTLET ? { outletId: outletId! } : {}),
          items: form.items,
        },
        idempotencyKey,
      ),
    onSuccess: () => {
      setIdempotencyKey(crypto.randomUUID());
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      reset({ items: [{ menuItemId: 0, quantity: 1 }] });
      setDialogOpen(false);
      addToast('Sale created', 'success');
    },
    onError: (err) => {
      if (err instanceof ApiError && err.errors) {
        const k = Object.keys(err.errors)[0];
        if (k) setError('root', { message: err.errors[k] });
        else setError('root', { message: err.message });
      } else setError('root', { message: err instanceof Error ? err.message : 'Create sale failed' });
    },
  });

  if (user?.role !== ROLE_OUTLET && outletId == null) {
    return (
      <div className="p-6">
        <div className="mb-6 flex items-center gap-2">
          <Receipt className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Sales</h1>
        </div>
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Select an outlet from the sidebar to view sales.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Receipt className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Sales</h1>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New sale
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>}
          {isError && <p className="py-8 text-center text-sm text-destructive">Failed to load sales.</p>}
          {data && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Receipt</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                        No sales yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.items.map((row: Sale) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.receiptNumber}</TableCell>
                        <TableCell className="text-muted-foreground">{row.totalAmount}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}
                        </TableCell>
                        <TableCell>
                          <Link to={`/sales/${row.id}`} className={cn(buttonVariants({ variant: 'link' }), 'p-0 h-auto text-primary')}>
                            <FileText className="inline h-3.5 w-3.5 mr-1" />
                            Receipt
                          </Link>
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
          <div className="rounded-lg border border-border bg-card p-6 shadow-lg w-full max-w-md max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-foreground mb-4">New sale</h2>
            <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-3">
              {errors.root && <p className="text-sm text-destructive" role="alert">{errors.root.message}</p>}
              <div className="space-y-2">
                {fields.map((field, i) => (
                  <div key={field.id} className="flex gap-2 items-end">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Item</Label>
                      <select {...register(`items.${i}.menuItemId`, { valueAsNumber: true })} className={cn('flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm')}>
                        <option value={0}>Select</option>
                        {(menuData?.items ?? []).filter((m) => m.isActive !== false).map((m) => <option key={m.id} value={m.id}>{m.name ?? m.id} — {m.outletPrice ?? m.basePrice}</option>)}
                      </select>
                    </div>
                    <div className="w-20 space-y-1">
                      <Label className="text-xs">Qty</Label>
                      <Input type="number" min={1} className="h-8" {...register(`items.${i}.quantity`, { valueAsNumber: true })} />
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => remove(i)}>Remove</Button>
                  </div>
                ))}
                <Button type="button" variant="ghost" size="sm" onClick={() => append({ menuItemId: 0, quantity: 1 })} className="gap-1">+ Add line</Button>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending}>Create</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
