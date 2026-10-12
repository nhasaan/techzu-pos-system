import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';

interface PaginationProps {
  pageNumber: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}

/** Prev/next controls for cursor-paginated lists (no total count: it would cost a COUNT(*) per request). */
export default function Pagination({ pageNumber, hasPrev, hasNext, onPrev, onNext }: PaginationProps) {
  if (!hasPrev && !hasNext) return null;
  return (
    <div className="mt-4 flex items-center justify-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={onPrev} disabled={!hasPrev} className="gap-1">
        <ChevronLeft className="h-4 w-4" />
        Prev
      </Button>
      <span className="min-w-[4rem] text-center text-sm text-muted-foreground">Page {pageNumber}</span>
      <Button type="button" variant="outline" size="sm" onClick={onNext} disabled={!hasNext} className="gap-1">
        Next
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
