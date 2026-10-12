import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

type Phase = 'open' | 'closing' | 'closed';
const EXIT_MS = 160;

/**
 * Animated modal: fades/zooms in, plays an exit animation before unmounting, closes on Escape or
 * backdrop click, locks page scroll and focuses the first field. Rendered in a portal.
 */
export function Dialog({ open, onClose, title, description, children, className }: DialogProps) {
  const [phase, setPhase] = useState<Phase>(open ? 'open' : 'closed');
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Adjust state while rendering when the prop changes (no extra effect pass).
  if (open && phase !== 'open') setPhase('open');
  if (!open && phase === 'open') setPhase('closing');

  useEffect(() => {
    if (phase !== 'closing') return;
    const t = setTimeout(() => setPhase('closed'), EXIT_MS);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>('input, select, textarea, button:not([data-dialog-close])')?.focus();
    });
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (phase === 'closed') return null;
  const closing = phase === 'closing';

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div
        className={cn(
          'absolute inset-0 bg-black/50 backdrop-blur-[2px]',
          closing ? 'animate-out fade-out-0 fill-mode-forwards duration-150' : 'animate-in fade-in-0 duration-200',
        )}
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'relative w-full max-w-md max-h-[90vh] overflow-auto rounded-lg border border-border bg-card p-6 shadow-xl',
          closing
            ? 'animate-out fade-out-0 zoom-out-95 fill-mode-forwards duration-150'
            : 'animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-200 ease-out-expo',
          className,
        )}
      >
        <button
          type="button"
          data-dialog-close
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <h2 id={titleId} className="mb-1 pr-6 text-lg font-semibold text-foreground">
          {title}
        </h2>
        {description && <p className="mb-4 text-sm text-muted-foreground">{description}</p>}
        <div className={cn(!description && 'mt-3')}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
