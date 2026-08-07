import { motion } from 'framer-motion';
import { useState, type PointerEvent } from 'react';

import { spring } from '@/lib/motion/presets';

/**
 * Кнопка «Нет», которая уклоняется от пальца (ТЗ 7.6).
 *
 * Главная тонкость — событие. На десктопе кнопка убегает по `onMouseEnter`,
 * но на мобильном наведения не существует, поэтому там уклонение висит на
 * `onPointerDown`: кнопка успевает сместиться до того, как палец завершит
 * тап, и `onClick` не срабатывает.
 *
 * После четвёртой попытки она сжимается в ноль и исчезает совсем —
 * остаётся только «Да». Это шутка, а не издевательство: после третьего
 * уклонения под кнопкой появляется подпись «(эта кнопка сломалась)».
 */

const MAX_ATTEMPTS = 4;
const RANGE_X = 160;
const RANGE_Y = 120;

type RunawayNoProps = {
  label: string;
  evadeCount: number;
  onEvade: () => void;
};

export function RunawayNo({ label, evadeCount, onEvade }: RunawayNoProps) {
  const [offset, setOffset] = useState({ x: 0, y: 0, rotate: 0 });

  const gone = evadeCount >= MAX_ATTEMPTS;

  const evade = (event: PointerEvent<HTMLButtonElement>) => {
    // Гасим тап до того, как он превратится в click.
    event.preventDefault();
    setOffset({
      x: (Math.random() - 0.5) * RANGE_X,
      y: (Math.random() - 0.5) * RANGE_Y,
      // На каждой попытке кнопка ещё и заваливается набок.
      rotate: (Math.random() - 0.5) * 24,
    });
    onEvade();
  };

  if (gone) {
    return (
      <p className="text-center font-mono text-label uppercase text-ghost">
        кнопка «нет» ушла насовсем
      </p>
    );
  }

  return (
    <div className="relative flex min-h-[64px] items-center justify-center">
      <motion.button
        type="button"
        onPointerDown={evade}
        onMouseEnter={() => setOffset({
          x: (Math.random() - 0.5) * RANGE_X,
          y: (Math.random() - 0.5) * RANGE_Y,
          rotate: (Math.random() - 0.5) * 24,
        })}
        animate={{
          x: offset.x,
          y: offset.y,
          rotate: offset.rotate,
          // С каждой попыткой кнопка мельчает.
          scale: 1 - evadeCount * 0.16,
        }}
        transition={spring.snappy}
        className="min-h-tap rounded-pill border border-stroke px-8 text-body text-mist"
      >
        {label}
      </motion.button>
    </div>
  );
}

export { MAX_ATTEMPTS };
