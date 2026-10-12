import { useState } from 'react';
import { BarChart3, DollarSign, Receipt, Store, Trophy } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth';
import { ROLE_OUTLET } from '../constants/roles';
import { useOutletStore } from '../store/outlet';
import { getRevenueByOutlet, getSalesSummary, getTopItems, type DateRange } from '../api/reports';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { cn } from '../lib/utils';

const money = (n: number) => n.toFixed(2);

export default function Reports() {
  const user = useAuthStore((s) => s.user);
  const selectedOutletId = useOutletStore((s) => s.selectedOutletId);
  const setSelectedOutletId = useOutletStore((s) => s.setSelectedOutletId);
  const isOutletUser = user?.role === ROLE_OUTLET;
  const outletId = isOutletUser ? user?.outletId ?? null : selectedOutletId;
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const range: DateRange = { ...(dateFrom && { dateFrom }), ...(dateTo && { dateTo }) };
  const rangeInvalid = Boolean(dateFrom && dateTo && dateFrom > dateTo);

  const revenue = useQuery({
    queryKey: ['reports', 'revenue-by-outlet', dateFrom, dateTo],
    queryFn: () => getRevenueByOutlet(range),
    enabled: !rangeInvalid,
  });

  const summary = useQuery({
    queryKey: ['reports', 'summary', outletId, dateFrom, dateTo],
    queryFn: () => getSalesSummary(outletId!, range),
    enabled: outletId != null && !rangeInvalid,
  });

  const topItems = useQuery({
    queryKey: ['reports', 'top-items', outletId, dateFrom, dateTo],
    queryFn: () => getTopItems(outletId!, { ...range, limit: 5 }),
    enabled: outletId != null && !rangeInvalid,
  });

  const outletName = revenue.data?.items.find((o) => o.outletId === outletId)?.outletName ?? (outletId ? `Outlet ${outletId}` : '');

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Reports</h1>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-card px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground shrink-0">Date range</span>
        <div className="flex items-center gap-2">
          <Input id="dateFrom" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 w-auto text-sm" />
          <span className="text-muted-foreground">–</span>
          <Input id="dateTo" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 w-auto text-sm" />
        </div>
        {rangeInvalid && <span className="text-xs text-destructive">Start date must be on or before end date.</span>}
      </div>

      {/* Total revenue by outlet */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Store className="h-4 w-4 text-muted-foreground" />
            Revenue by outlet
          </CardTitle>
          <CardDescription>
            {isOutletUser ? 'Your outlet' : 'All outlets'}
            {revenue.data && !isOutletUser && <> · Total {money(revenue.data.totalRevenue)}</>}
            {!isOutletUser && ' · Click a row for outlet details'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {revenue.isLoading && <p className="py-4 text-sm text-muted-foreground">Loading…</p>}
          {revenue.isError && <p className="py-4 text-sm text-destructive">Failed to load revenue.</p>}
          {revenue.data && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Outlet</TableHead>
                  <TableHead className="text-right">Transactions</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {revenue.data.items.map((o) => (
                  <TableRow
                    key={o.outletId}
                    onClick={isOutletUser ? undefined : () => setSelectedOutletId(o.outletId)}
                    className={cn(!isOutletUser && 'cursor-pointer', o.outletId === outletId && 'bg-primary/5')}
                  >
                    <TableCell className="font-medium">{o.outletName}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{o.transactionCount}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{money(o.totalRevenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {outletId == null ? (
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Select an outlet to view its sales summary and top items.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Outlet summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                {outletName}
              </CardTitle>
              {(dateFrom || dateTo) && <CardDescription>Period: {dateFrom || '—'} to {dateTo || '—'}</CardDescription>}
            </CardHeader>
            <CardContent className="space-y-4">
              {summary.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
              {summary.isError && <p className="text-sm text-destructive">Failed to load summary.</p>}
              {summary.data && (
                <>
                  <div className="flex items-center gap-3">
                    <div className="rounded-md bg-primary/10 p-2">
                      <Receipt className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-semibold text-foreground">{summary.data.transactionCount} transactions</p>
                      <p className="text-sm text-muted-foreground">Total count</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="rounded-md bg-primary/10 p-2">
                      <DollarSign className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-semibold text-foreground">{money(summary.data.totalRevenue)}</p>
                      <p className="text-sm text-muted-foreground">Total revenue</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Top 5 items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy className="h-4 w-4 text-muted-foreground" />
                Top 5 selling items
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topItems.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
              {topItems.isError && <p className="text-sm text-destructive">Failed to load top items.</p>}
              {topItems.data && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topItems.data.items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">No sales in this period.</TableCell>
                      </TableRow>
                    ) : (
                      topItems.data.items.map((it, i) => (
                        <TableRow key={it.menuItemId}>
                          <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="font-medium">{it.name}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{it.quantitySold}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{money(it.revenue)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
