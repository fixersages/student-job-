/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 12px 24px -6px rgb(15 23 42 / 0.08)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.07), 0 20px 40px -12px rgb(37 99 235 / 0.12)',
      },
      backgroundImage: {
        'grid-slate': `
          linear-gradient(to right, rgb(241 245 249 / 0.85) 1px, transparent 1px),
          linear-gradient(to bottom, rgb(241 245 249 / 0.85) 1px, transparent 1px)
        `,
      },
      backgroundSize: {
        grid: '48px 48px',
      },
    },
  },
  plugins: [],
}
