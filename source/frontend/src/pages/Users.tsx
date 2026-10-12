import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Users as UsersIcon, Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { listUsers, type User } from '../api/users';
import RequireSuperadmin from '../components/RequireSuperadmin';
import { ROLE_LABELS, type UserRole } from '../constants/roles';
import { buttonVariants } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import Pagination from '../components/Pagination';
import { cn } from '../lib/utils';

const PAGE_SIZE = 20;

function UsersContent() {
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['users', page, PAGE_SIZE],
    queryFn: () => listUsers({ page, limit: PAGE_SIZE }),
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
          {isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>}
          {isError && <p className="py-8 text-center text-sm text-destructive">Failed to load users.</p>}
          {data && (
            <>
              <Table>
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
                    data.items.map((row: User) => (
                      <TableRow key={row.id}>
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
              <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
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
