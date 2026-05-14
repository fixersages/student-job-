/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        /** JobsDB 风格主色：深蓝顶栏 / 标题 */
        navy: {
          50: '#e8eef6',
          100: '#c9d7e8',
          200: '#9bb4d1',
          300: '#6789b4',
          400: '#3d5f8f',
          500: '#1e4778',
          600: '#153a66',
          700: '#0f3058',
          800: '#0a2649',
          900: '#002d5b',
          950: '#001a38',
        },
        /** 主操作强调：品红按钮 */
        accent: {
          50: '#fdf2f8',
          100: '#fce7f3',
          200: '#fbcfe8',
          300: '#f9a8d4',
          400: '#f472b6',
          500: '#ec4899',
          600: '#db2777',
          700: '#be185d',
          800: '#9d174d',
          900: '#831843',
        },
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
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f8fafc',
          subtle: '#f1f5f9',
        },
        /** 列表区浅灰底 */
        panel: {
          DEFAULT: '#f4f6f9',
          deep: '#e8ecf2',
        },
      },
      fontFamily: {
        sans: [
          'DM Sans',
          'Noto Sans SC',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(15 23 42 / 0.06), 0 4px 20px -4px rgb(15 23 42 / 0.08)',
        'card-hover':
          '0 4px 12px -2px rgb(15 23 42 / 0.08), 0 12px 28px -8px rgb(15 23 42 / 0.12)',
        nav: '0 1px 0 0 rgb(15 23 42 / 0.08)',
        'card-active':
          '0 0 0 2px rgb(37 99 235 / 0.35), 0 4px 16px -4px rgb(15 23 42 / 0.1)',
        soft: '0 2px 8px -2px rgb(15 23 42 / 0.06)',
      },
      backgroundImage: {
        'grid-slate': `
          linear-gradient(to right, rgb(226 232 240 / 0.5) 1px, transparent 1px),
          linear-gradient(to bottom, rgb(226 232 240 / 0.5) 1px, transparent 1px)
        `,
        'hero-detail':
          'linear-gradient(135deg, rgb(0 45 91) 0%, rgb(30 64 175) 45%, rgb(190 24 93 / 0.35) 100%)',
      },
      backgroundSize: {
        grid: '40px 40px',
      },
      transitionDuration: {
        DEFAULT: '200ms',
      },
    },
  },
  plugins: [],
}
