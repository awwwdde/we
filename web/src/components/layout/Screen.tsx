import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

import { screenVariants, spring } from '@/lib/motion/presets';

type ScreenProps = {
  title?: string;
  /** Экраны с таббаром нуждаются в нижнем отступе, иначе контент уедет под pill. */
  withTabBar?: boolean;
  children?: ReactNode;
};

/** Базовая обёртка экрана: безопасные зоны, заголовок, единый переход. */
export function Screen({ title, withTabBar = true, children }: ScreenProps) {
  return (
    <motion.main
      variants={screenVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={spring.soft}
      className={['screen min-h-[100dvh]', withTabBar ? 'pb-tabbar' : ''].join(' ')}
    >
      {title && <h1 className="font-display text-display-l uppercase mb-6">{title}</h1>}
      {children}
    </motion.main>
  );
}
