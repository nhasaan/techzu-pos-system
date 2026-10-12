import { useState } from 'react';

/** Keyset-paginated list response from the API. */
export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
}

export interface ListParams {
  cursor?: string;
  limit?: number;
}

/** Query-string params for a list call; the cursor is only sent when present. */
export function listQuery({ cursor, limit = 20 }: ListParams = {}): Record<string, string | number> {
  return cursor ? { cursor, limit } : { limit };
}

/**
 * Prev/next navigation over cursor pages. The API only knows "the page after this cursor", so we keep
 * the cursors of the pages already visited to go back. Scoped to `scope` (e.g. the outlet): changing
 * it starts again from the first page.
 */
export function useCursorPager(scope: unknown = null) {
  const [state, setState] = useState<{ scope: unknown; stack: (string | undefined)[] }>({ scope, stack: [undefined] });
  const stack = state.scope === scope ? state.stack : [undefined];
  return {
    cursor: stack[stack.length - 1],
    pageNumber: stack.length,
    hasPrev: stack.length > 1,
    next: (nextCursor: string | null) => {
      if (nextCursor) setState({ scope, stack: [...stack, nextCursor] });
    },
    prev: () => setState({ scope, stack: stack.length > 1 ? stack.slice(0, -1) : stack }),
  };
}
