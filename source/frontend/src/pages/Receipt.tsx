import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getSale } from '../api/sales';
import { Card, CardContent } from '../components/ui/card';
import { Skeleton, TableSkeleton } from '../components/ui/skeleton';
import { rowEnter } from '../lib/motion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { buttonVariants } from '../components/ui/button';
import { cn } from '../lib/utils';

export default function Receipt() {
  const { saleId } = useParams<{ saleId: string }>();
  const id = saleId ? parseInt(saleId, 10) : NaN;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['sale', id],
    queryFn: () => getSale(id),
    enabled: Number.isInteger(id),
  });

  if (!saleId || !Number.isInteger(id)) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Invalid receipt.</p>
        <Link to="/sales" className={cn(buttonVariants({ variant: 'link' }), 'mt-2')}>Back to Sales</Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 max-w-lg">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-56" />
            <TableSkeleton rows={3} cols={4} />
          </CardContent>
        </Card>
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="p-6">
        <p className="text-destructive">Receipt not found.</p>
        <Link to="/sales" className={cn(buttonVariants({ variant: 'link' }), 'mt-2')}>Back to Sales</Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-lg">
      <Card className="animate-in fade-in-0 zoom-in-[0.98] duration-300 ease-out-expo">
        <CardContent className="pt-6">
          <h1 className="text-xl font-semibold text-foreground">Receipt #{data.receiptNumber}</h1>
          <p className="text-sm text-muted-foreground mt-1">Outlet {data.outletId} · {data.createdAt ? new Date(data.createdAt).toLocaleString() : '—'}</p>
          <Table className="mt-4">
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((line, i) => (
                <TableRow key={line.id} {...rowEnter(i)}>
                  <TableCell className="font-medium">{line.itemName ?? `Item #${line.menuItemId}`}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{line.quantity}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{line.priceAtSale}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{(parseFloat(line.priceAtSale) * line.quantity).toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="mt-4 text-right font-semibold text-foreground">Total: {data.totalAmount}</p>
        </CardContent>
      </Card>
      <Link to="/sales" className={cn(buttonVariants({ variant: 'link' }), 'mt-4 inline-flex')}>← Back to Sales</Link>
    </div>
  );
}
