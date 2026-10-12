import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'dark' | 'light';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

let fadeTimer: ReturnType<typeof setTimeout> | undefined;

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.add('theme-transition');
  root.classList.remove('dark', 'light');
  root.classList.add(theme);
  clearTimeout(fadeTimer);
  fadeTimer = setTimeout(() => root.classList.remove('theme-transition'), 300);
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'dark',
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
      toggleTheme: () => {
        set((s) => {
          const next = s.theme === 'dark' ? 'light' : 'dark';
          applyTheme(next);
          return { theme: next };
        });
      },
    }),
    { name: 'pos-theme', partialize: (s) => ({ theme: s.theme }) }
  )
);
