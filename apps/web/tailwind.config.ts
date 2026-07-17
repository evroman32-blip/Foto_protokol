import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        graphite: '#2C2F33',
        accent: {
          DEFAULT: '#E85D04',
          hover: '#D35400',
          light: '#FEF3EC',
        },
        border: {
          DEFAULT: '#E5E7EB',
          strong: '#D1D5DB',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#F9FAFB',
        },
        status: {
          success: '#15803D',
          warning: '#B45309',
          error: '#B91C1C',
          info: '#1D4ED8',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
