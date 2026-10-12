import { Link } from 'react-router-dom';
import { Store, Plus } from 'lucide-react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import RequireHQOrSuperadmin from '../components/RequireHQOrSuperadmin';
import Pagination from '../components/Pagination';
import { useCursorPager } from '../lib/pagination';
import { listOutlets, type Outlet } from '../api/outlets';
import { buttonVariants } from '../components/ui/button';
import { cn } from '../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';

const PAGE_SIZE = 20;

function OutletsContent() {
  const pager = useCursorPager(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['outlets', pager.cursor, PAGE_SIZE],
    queryFn: () => listOutlets({ cursor: pager.cursor, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Store className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Outlets</h1>
        </div>
        <Link to="/outlets/new" className={cn(buttonVariants(), 'gap-2')}>
          <Plus className="h-4 w-4" />
          Add outlet
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All outlets</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
          )}
          {isError && (
            <p className="py-8 text-center text-sm text-destructive">Failed to load outlets.</p>
          )}
          {data && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="py-8 text-center text-muted-foreground">
                        No outlets yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.items.map((o: Outlet) => (
                      <TableRow key={o.id}>
                        <TableCell className="font-medium">{o.name}</TableCell>
                        <TableCell className="text-muted-foreground">{o.address ?? '—'}</TableCell>
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

export default function Outlets() {
  return (
    <RequireHQOrSuperadmin>
      <OutletsContent />
    </RequireHQOrSuperadmin>
  );
}
