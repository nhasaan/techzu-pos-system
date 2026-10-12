import { create } from 'zustand';
import { uuid } from '../lib/utils';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  /** Set while the exit animation plays, just before removal. */
  leaving?: boolean;
}

const EXIT_MS = 200;

interface ToastState {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  addToast: (message, type = 'info') => {
    const id = uuid();
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => get().removeToast(id), 3500);
  },
  removeToast: (id) => {
    if (!get().toasts.some((t) => t.id === id && !t.leaving)) return;
    set((s) => ({ toasts: s.toasts.map((t) => (t.id === id ? { ...t, leaving: true } : t)) }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), EXIT_MS);
  },
}));
