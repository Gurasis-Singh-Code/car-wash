'use client';

import React, { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

const LABELS = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
} as const;

export default function ThemeToggle() {
  const { theme, cycleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // The stored theme is only known on the client, so render a stable
  // placeholder on the server and for the first paint to avoid a hydration
  // mismatch on the icon.
  useEffect(() => setMounted(true), []);

  const Icon = !mounted ? Monitor : theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;

  return (
    <button
      type="button"
      onClick={cycleTheme}
      title={mounted ? `Theme: ${LABELS[theme]} (click to change)` : 'Change theme'}
      aria-label={mounted ? `Change theme, currently ${LABELS[theme]}` : 'Change theme'}
      className="flex items-center justify-center lg:justify-start gap-1 h-9 w-9 sm:h-10 sm:w-10 lg:h-auto lg:w-auto lg:px-3 lg:py-2 rounded-xl text-xs font-medium text-charcoal-muted hover:text-charcoal hover:bg-sage-100/70 border border-transparent transition-all"
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="hidden lg:inline">{mounted ? LABELS[theme] : 'Theme'}</span>
    </button>
  );
}
