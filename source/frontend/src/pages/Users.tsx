import { Link } from 'react-router-dom';
import { TableSkeleton } from '../components/ui/skeleton';
import { rowEnter } from '../lib/motion';
import { Users as UsersIcon, Plus } from 'lucide-react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { listUsers, type User } from '../api/users';
import RequireSuperadmin from '../components/RequireSuperadmin';
import { ROLE_LABELS, type UserRole } from '../constants/roles';
import { buttonVariants } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import Pagination from '../components/Pagination';
import { useCursorPager } from '../lib/pagination';
import { cn } from '../lib/utils';

const PAGE_SIZE = 20;

function UsersContent() {
  const pager = useCursorPager(null);

  const { data, isLoading, isError, isPlaceholderData } = useQuery({
    queryKey: ['users', pager.cursor, PAGE_SIZE],
    queryFn: () => listUsers({ cursor: pager.cursor, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UsersIcon className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">User management</h1>
        </div>
        <Link to="/users/new" className={cn(buttonVariants(), 'gap-2')}>
          <Plus className="h-4 w-4" />
          Add user
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All users</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <TableSkeleton cols={5} />}
          {isError && <p className="py-8 text-center text-sm text-destructive">Failed to load users.</p>}
          {data && (
            <>
              <Table className={cn('transition-opacity duration-200', isPlaceholderData && 'opacity-60')}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Outlet</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                        No users yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.items.map((row: User, i) => (
                      <TableRow key={row.id} {...rowEnter(i)}>
                        <TableCell className="font-medium">{row.username}</TableCell>
                        <TableCell className="text-muted-foreground">{ROLE_LABELS[row.role as UserRole] ?? row.role}</TableCell>
                        <TableCell className="text-muted-foreground">{row.outletId ?? '—'}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}
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

export default function Users() {
  return (
    <RequireSuperadmin>
      <UsersContent />
    </RequireSuperadmin>
  );
}
