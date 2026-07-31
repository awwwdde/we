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
