/**
 * Общие пресеты движения (ТЗ 8.2).
 *
 * Все переходы экранов используют их: разнобой в тайминге читается
 * как неаккуратность сильнее, чем отсутствие анимации вообще.
 */

export const spring = {
  soft: { type: 'spring', stiffness: 260, damping: 30 },
  snappy: { type: 'spring', stiffness: 400, damping: 34 },
  sheet: { type: 'spring', stiffness: 300, damping: 32, mass: 0.8 },
} as const;

export const screenVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
} as const;

/**
 * То же самое без сдвига — для `prefers-reduced-motion` (ТЗ 8.4).
 *
 * Экран не появляется мгновенно: без всякого перехода смена содержимого
 * читается как сбой, а не как навигация. Остаётся фейд 120мс — движения
 * в нём нет, только яркость.
 */
export const screenVariantsReduced = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
} as const;

export const fade = { duration: 0.12 } as const;

/**
 * Задержка ступенчатого появления списка (ТЗ 8.1).
 *
 * При `prefers-reduced-motion` — ноль: список показывается разом, иначе
 * «волна» остаётся ровно тем движением, от которого человек отказался.
 */
export function staggerDelay(index: number, reduced: boolean): number {
  return reduced ? 0 : Math.min(index * 0.04, 0.3);
}
