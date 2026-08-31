import type { Config } from 'tailwindcss';

/**
 * Every colour is driven by a CSS variable holding raw "R G B" channels, so the
 * existing class names (bg-canvas, text-charcoal, bg-sage-100/70, ...) swap
 * palettes automatically when the `dark` class is on <html>. Channels rather
 * than hex keeps Tailwind's opacity modifiers (`/60`, `/40`) working.
 *
 * Palette values live in app/globals.css.
 */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const ramp = (name: string) => ({
  50: token(`${name}-50`),
  100: token(`${name}-100`),
  200: token(`${name}-200`),
  300: token(`${name}-300`),
  400: token(`${name}-400`),
  500: token(`${name}-500`),
  600: token(`${name}-600`),
  700: token(`${name}-700`),
  800: token(`${name}-800`),
  900: token(`${name}-900`),
});

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    // Class-name maps live here too (e.g. LEAD_STATUS_STYLES in types/lead.ts).
    // Without these globs those classes are never generated and render as transparent.
    './types/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      screens: {
        // Smallest phones (iPhone SE and similar) sit below this.
        xs: '360px',
      },
      colors: {
        canvas: token('canvas'),
        charcoal: {
          DEFAULT: token('charcoal'),
          muted: token('charcoal-muted'),
          light: token('charcoal-light'),
          border: token('charcoal-border'),
          card: token('charcoal-card'),
          surface: token('charcoal-surface'),
        },
        sage: ramp('sage'),
        emerald: ramp('emerald'),
        red: ramp('red'),
        amber: ramp('amber'),
        sky: ramp('sky'),
        purple: ramp('purple'),
        pink: ramp('pink'),
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'soft-xs': '0 1px 2px rgba(0, 0, 0, 0.03)',
        'soft-sm': '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
        'soft-md': '0 4px 6px -1px rgba(0, 0, 0, 0.04), 0 2px 4px -1px rgba(0, 0, 0, 0.02)',
        'soft-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.04), 0 4px 6px -2px rgba(0, 0, 0, 0.02)',
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
      },
    },
  },
  plugins: [],
};

export default config;
