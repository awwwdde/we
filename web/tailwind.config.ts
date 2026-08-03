import type { Config } from 'tailwindcss';

/**
 * Дизайн-токены Перигей (ТЗ, раздел 5).
 *
 * Дисциплина цвета: `lime` означает ровно одно — свидание подтверждено.
 * `ember` и `iris` — цвета людей, а не украшение.
 */
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#0B0A0F',
        surface: '#16141C',
        surface2: '#201D29',
        stroke: '#2E2A3B',

        chalk: '#F2EFF7',
        mist: '#8E88A0',
        ghost: '#4A4458',

        ember: '#FF4D4D',
        iris: '#7B5CFF',
        lime: '#C8FF6A',
      },

      fontFamily: {
        display: ['Unbounded Variable', 'system-ui', 'sans-serif'],
        body: ['Onest Variable', 'system-ui', 'sans-serif'],
        mono: ['Martian Mono Variable', 'ui-monospace', 'monospace'],
      },

      fontSize: {
        'display-xl': ['40px', { lineHeight: '40px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'display-l': ['28px', { lineHeight: '32px', letterSpacing: '-0.02em', fontWeight: '500' }],
        title: ['20px', { lineHeight: '26px', fontWeight: '600' }],
        // 16px — минимум для полей ввода, иначе Safari зумит страницу (ТЗ 15.3).
        body: ['16px', { lineHeight: '24px', fontWeight: '400' }],
        caption: ['13px', { lineHeight: '18px', fontWeight: '400' }],
        label: ['11px', { lineHeight: '12px', letterSpacing: '0.08em', fontWeight: '400' }],
      },

      borderRadius: {
        card: '28px',
        sheet: '32px',
        pill: '999px',
      },

      spacing: {
        screen: '20px',
        'safe-t': 'env(safe-area-inset-top)',
        'safe-b': 'env(safe-area-inset-bottom)',
      },

      boxShadow: {
        // На тёмном фоне глубина создаётся свечением, а не тенью (ТЗ 5.5).
        raised: '0 0 0 1px rgba(255,255,255,0.04), 0 20px 60px -20px rgba(0,0,0,0.8)',
        person: '0 0 40px -10px var(--person-color)',
      },

      minHeight: {
        // Минимальная зона нажатия (ТЗ 15.2).
        tap: '44px',
      },
      minWidth: {
        tap: '44px',
      },
    },
  },
  plugins: [],
};

export default config;
