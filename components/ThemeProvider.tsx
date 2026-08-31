'use client';

import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'theme';

interface ThemeContextType {
  /** What the user picked, including "system". */
  theme: Theme;
  /** What is actually on screen right now. */
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  /** Cycles light -> dark -> system. */
  cycleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => {},
  cycleTheme: () => {},
});

const prefersDark = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-color-scheme: dark)').matches;

function applyTheme(resolved: ResolvedTheme) {
  document.documentElement.classList.toggle('dark', resolved === 'dark');
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Always start at the SSR default so the first client render matches the
  // server. The pre-paint script in layout.tsx has already set the real class
  // on <html>, so there is no flash; the effect below syncs React state to it.
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');

  useEffect(() => {
    let stored: Theme | null = null;
    try {
      stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
    } catch {
      // Private mode or blocked storage - fall back to system.
    }

    const initial: Theme = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
    setThemeState(initial);
    setResolvedTheme(initial === 'system' ? (prefersDark() ? 'dark' : 'light') : initial);
  }, []);

  // Follow the OS while the user is on "system".
  useEffect(() => {
    if (theme !== 'system' || typeof window === 'undefined') return;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const next: ResolvedTheme = media.matches ? 'dark' : 'light';
      setResolvedTheme(next);
      applyTheme(next);
    };

    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);

    const resolved: ResolvedTheme = next === 'system' ? (prefersDark() ? 'dark' : 'light') : next;
    setResolvedTheme(resolved);
    applyTheme(resolved);

    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Persisting is a convenience; ignore storage failures.
    }
  }, []);

  const cycleTheme = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light');
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, cycleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
