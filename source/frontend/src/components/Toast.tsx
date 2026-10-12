import { X } from 'lucide-react';
import { useToastStore } from '../store/toast';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

const typeStyles: Record<string, string> = {
  success: 'border-primary/50 bg-primary text-primary-foreground',
  error: 'border-destructive/50 bg-destructive text-white',
  info: 'bg-muted text-muted-foreground border-border',
};

export default function Toast() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="alert"
          className={cn(
            'pointer-events-auto flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg',
            t.leaving
              ? 'animate-out fade-out-0 slide-out-to-right-8 fill-mode-forwards duration-200'
              : 'animate-in fade-in-0 slide-in-from-right-8 duration-300 ease-out-expo',
            typeStyles[t.type] ?? typeStyles.info
          )}
        >
          <span>{t.message}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 opacity-80 hover:opacity-100 hover:bg-black/10"
            onClick={() => removeToast(t.id)}
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
