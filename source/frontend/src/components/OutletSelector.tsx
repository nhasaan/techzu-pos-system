import { ChevronDown, Store } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { listOutlets } from '../api/outlets';
import { useOutletStore } from '../store/outlet';
import { useAuthStore } from '../store/auth';
import { cn } from '../lib/utils';
import { ROLE_HQ, ROLE_SUPERADMIN } from '../constants/roles';

export default function OutletSelector() {
  const user = useAuthStore((s) => s.user);
  const selectedOutletId = useOutletStore((s) => s.selectedOutletId);
  const setSelectedOutletId = useOutletStore((s) => s.setSelectedOutletId);

  const isHQOrSuperadmin = user?.role === ROLE_HQ || user?.role === ROLE_SUPERADMIN;
  const { data, isLoading } = useQuery({
    queryKey: ['outlets', 1, 100],
    queryFn: () => listOutlets({ page: 1, limit: 100 }),
    enabled: isHQOrSuperadmin,
  });

  if (!isHQOrSuperadmin || isLoading || !data?.items?.length) return null;

  return (
    <div className="flex items-center gap-1.5 rounded-md border border-input bg-muted/50 px-2 py-1.5">
      <Store className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <select
        id="outlet-select"
        value={selectedOutletId ?? ''}
        onChange={(e) => setSelectedOutletId(e.target.value ? Number(e.target.value) : null)}
        className={cn(
          'min-w-0 flex-1 appearance-none bg-transparent text-sm font-medium text-foreground outline-none',
          'focus:ring-0 [&>option]:bg-card [&>option]:text-foreground'
        )}
        aria-label="Switch outlet"
      >
        <option value="">Select outlet</option>
        {data.items.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground pointer-events-none" />
    </div>
  );
}
