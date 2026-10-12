import { UtensilsCrossed } from 'lucide-react';
import { TableSkeleton } from '../components/ui/skeleton';
import { rowEnter } from '../lib/motion';
import { cn } from '../lib/utils';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth';
import { ROLE_OUTLET } from '../constants/roles';
import { useOutletStore } from '../store/outlet';
import { listMenuByOutlet, type OutletMenuItem } from '../api/menu';
import Pagination from '../components/Pagination';
import { useCursorPager } from '../lib/pagination';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';

const PAGE_SIZE = 20;

export default function Menu() {
  const user = useAuthStore((s) => s.user);
  const selectedOutletId = useOutletStore((s) => s.selectedOutletId);
  const outletId = user?.role === ROLE_OUTLET ? user?.outletId ?? null : selectedOutletId;
  const pager = useCursorPager(outletId);

  const { data, isLoading, isError, isPlaceholderData } = useQuery({
    queryKey: ['menu', 'outlet', outletId, pager.cursor, PAGE_SIZE],
    queryFn: () => listMenuByOutlet(outletId!, { cursor: pager.cursor, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
    enabled: outletId != null,
  });

  if (user?.role !== ROLE_OUTLET && outletId == null) {
    return (
      <div className="p-6">
        <div className="mb-6 flex items-center gap-2">
          <UtensilsCrossed className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Menu</h1>
        </div>
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Select an outlet from the sidebar to view its menu.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-2">
        <UtensilsCrossed className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Menu</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Outlet menu</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <TableSkeleton cols={4} />}
          {isError && <p className="py-8 text-center text-sm text-destructive">Failed to load menu.</p>}
          {data && (
            <>
              <Table className={cn('transition-opacity duration-200', isPlaceholderData && 'opacity-60')}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                        No items for this outlet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.items.map((row: OutletMenuItem, i) => (
                      <TableRow key={row.id} {...rowEnter(i)}>
                        <TableCell className="font-medium">{row.name ?? '—'}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.outletPrice ?? row.basePrice}
                          {row.outletPrice != null && row.outletPrice !== row.basePrice && (
                            <span className="ml-2 text-xs" title={`Base price ${row.basePrice}`}>(override)</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={row.isActive ? 'default' : 'secondary'}>
                            {row.isActive ? 'Yes' : 'No'}
                          </Badge>
                        </TableCell>
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
    </div>
  );
}
