import type { CSSProperties } from 'react';

/** Props for a list row that fades up with a small stagger (capped so long lists stay snappy). */
export function rowEnter(index: number): { className: string; style: CSSProperties } {
  return { className: 'row-enter', style: { '--row-delay': `${Math.min(index, 12) * 25}ms` } as CSSProperties };
}
