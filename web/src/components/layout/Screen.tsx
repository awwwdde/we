import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

import { fade, screenVariants, screenVariantsReduced, spring } from '@/lib/motion/presets';

type ScreenProps = {
  title?: string;
  /** Экраны с таббаром нуждаются в нижнем отступе, иначе контент уедет под pill. */
  withTabBar?: boolean;
  children?: ReactNode;
};

/** Базовая обёртка экрана: безопасные зоны, заголовок, единый переход. */
export function Screen({ title, withTabBar = true, children }: ScreenProps) {
  // При `prefers-reduced-motion` переход экрана — фейд 120мс без сдвига
  // (ТЗ 8.4). Одного правила в CSS мало: длительности пружины Framer Motion
  // задаёт из JS, и `transition-duration` из медиазапроса до неё не достаёт.
  const reduced = useReducedMotion();

  return (
    <motion.main
      variants={reduced ? screenVariantsReduced : screenVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={reduced ? fade : spring.soft}
      className={['screen min-h-[100dvh]', withTabBar ? 'pb-tabbar' : ''].join(' ')}
    >
      {title && <h1 className="font-display text-display-l uppercase mb-6">{title}</h1>}
      {children}
    </motion.main>
  );
}
