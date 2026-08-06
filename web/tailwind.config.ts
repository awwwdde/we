import type { Config } from 'tailwindcss';

/**
 * Дизайн-токены «Перигея» — редизайн «Тёплая ночь и одна орбита».
 *
 * Цвета заданы CSS-переменными, а не константами: те же имена работают
 * в тёмной и светлой теме, значения переключаются в styles/index.css.
 *
 * Дисциплина цвета сохранена: `lime` означает ровно одно — свидание
 * подтверждено. `ember` и `iris` — цвета людей, а не украшение.
 */
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Поверхности
        coal: 'var(--coal)',
        surface: 'var(--surface)',
        surface2: 'var(--surface2)',
        stroke: 'var(--stroke)',

        // Текст
        chalk: 'var(--chalk)',
        linen: 'var(--linen)', // абзацы и длинный текст
        mist: 'var(--mist)',
        ghost: 'var(--ghost)',

        // Смысловые
        ember: 'var(--ember)', // Влад
        iris: 'var(--iris)', // Ангелина
        lime: 'var(--lime)', // только «подтверждено»
      },

      fontFamily: {
        display: ['Unbounded Variable', 'system-ui', 'sans-serif'],
        body: ['Onest Variable', 'system-ui', 'sans-serif'],
        mono: ['Martian Mono Variable', 'ui-monospace', 'monospace'],
      },

      fontSize: {
        'display-xl': ['40px', { lineHeight: '38px', letterSpacing: '-0.03em', fontWeight: '700' }],
        'display-l': ['26px', { lineHeight: '30px', letterSpacing: '-0.03em', fontWeight: '500' }],
        title: ['20px', { lineHeight: '26px', fontWeight: '600' }],
        // 17px. Минимум для полей ввода — 16px, иначе Safari зумит страницу
        // при фокусе и вернуть масштаб уже нельзя (ТЗ 15.3).
        body: ['17px', { lineHeight: '26px', fontWeight: '400' }],
        caption: ['14px', { lineHeight: '20px', fontWeight: '400' }],
        label: ['11px', { lineHeight: '12px', letterSpacing: '0.14em', fontWeight: '400' }],
      },

      borderRadius: {
        card: '28px',
        sheet: '32px', // только верхние углы
        tile: '20px', // плитка, фото места
        cell: '14px', // ячейка календаря
        pill: '999px',
      },

      spacing: {
        screen: '24px',
        'safe-t': 'env(safe-area-inset-top)',
        'safe-b': 'env(safe-area-inset-bottom)',
      },

      boxShadow: {
        // На тёмном глубина — свечение, на светлом — тень. Переключается
        // переменной в index.css.
        raised: 'var(--shadow-raised)',
        person: '0 0 40px -10px var(--person-color)',
      },

      minHeight: { tap: '44px' },
      minWidth: { tap: '44px' },
    },
  },
  plugins: [],
};

export default config;
