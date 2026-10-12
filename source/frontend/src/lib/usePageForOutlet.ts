import { useState } from 'react';

/**
 * Page number scoped to an outlet: switching outlets starts again at page 1 instead of keeping a
 * page index that may not exist for the new outlet (which showed an empty table).
 */
export function usePageForOutlet(outletId: number | null) {
  const [state, setState] = useState({ outletId, page: 1 });
  const page = state.outletId === outletId ? state.page : 1;
  const setPage = (p: number) => setState({ outletId, page: p });
  return [page, setPage] as const;
}
