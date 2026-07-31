import type { CSSProperties } from 'react';

import { PERSON_HEX, type PersonColor } from '@/types/person';

type OrbProps = {
  color: PersonColor;
  /** Диаметр в px. */
  size: number;
  className?: string;
  style?: CSSProperties;
};

/**
 * Фирменная сфера (ТЗ 5.4).
 *
 * Это div с radial-gradient под blur — не картинка и не canvas: так дешевле
 * и масштабируется без потерь. Анимация состояний (дрейф / притяжение /
 * слияние) добавляется GSAP-таймлайнами в Фазе 8; здесь только форма и цвет.
 */
export function Orb({ color, size, className, style }: OrbProps) {
  const hex = PERSON_HEX[color];
  return (
    <div
      aria-hidden
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `radial-gradient(circle at 35% 35%, ${hex}, transparent 70%)`,
        filter: 'blur(60px)',
        opacity: 0.7,
        pointerEvents: 'none',
        ...style,
      }}
    />
  );
}
