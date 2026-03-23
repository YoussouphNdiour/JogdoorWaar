import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ─── Afro-Digital Warmth palette ──────────────────────
        terracotta: {
          DEFAULT: '#E8580A',
          50: '#FDF0E9',
          100: '#FAD9C4',
          500: '#E8580A',
          600: '#CC4D08',
          700: '#A33D06',
        },
        savane: {
          DEFAULT: '#1B4332',
          50: '#E8F0EC',
          100: '#C2D8CB',
          500: '#1B4332',
          600: '#153629',
          700: '#0F2920',
        },
        gold: {
          DEFAULT: '#F5C842',
          50: '#FEF9E7',
          100: '#FCF0BE',
          500: '#F5C842',
          600: '#D4AA32',
          700: '#A88728',
        },
        sand: {
          DEFAULT: '#FDFAF6',
          dark: '#F5EFE6',
          100: '#FDFAF6',
          200: '#F5EFE6',
          300: '#EDE3D3',
        },
      },
      fontFamily: {
        syne: ['var(--font-syne)', 'sans-serif'],
        dm: ['var(--font-dm-sans)', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'soft-lg': '0 10px 40px -10px rgba(0, 0, 0, 0.10)',
      },
    },
  },
  plugins: [],
};

export default config;
