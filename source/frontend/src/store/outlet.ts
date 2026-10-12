import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface OutletState {
  selectedOutletId: number | null;
  setSelectedOutletId: (id: number | null) => void;
}

export const useOutletStore = create<OutletState>()(
  persist(
    (set) => ({
      selectedOutletId: null,
      setSelectedOutletId: (id) => set({ selectedOutletId: id }),
    }),
    { name: 'pos-outlet', partialize: (s) => ({ selectedOutletId: s.selectedOutletId }) }
  )
);
