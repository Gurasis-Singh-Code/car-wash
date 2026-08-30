import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#FAF9F6', // off-white
        charcoal: {
          DEFAULT: '#2B2B2B',
          muted: '#666666',
          light: '#8E8E8E',
          border: '#E5E4DE',
          card: '#FFFFFF',
          surface: '#F4F3EE',
        },
        sage: {
          50: '#F5F7F4',
          100: '#E9EFE7',
          200: '#D5E0D1',
          300: '#BACDB4',
          400: '#9DB394',
          500: '#7C8B6F', // Main accent
          600: '#68775B',
          700: '#536048',
          800: '#404B37',
          900: '#2E3627',
        },
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
