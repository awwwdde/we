import { AnimatePresence } from 'framer-motion';
import type { CSSProperties } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import { TabBar } from '@/components/layout/TabBar';
import { PERSON_HEX } from '@/types/person';

/** Маршруты, на которых таббар скрыт (ТЗ 6.2). */
function hidesTabBar(pathname: string): boolean {
  return pathname.startsWith('/create') || pathname.startsWith('/i/') || pathname === '/onboarding';
}

export function AppLayout() {
  const location = useLocation();

  return (
    <div
      className="relative min-h-[100dvh] bg-void"
      // Цвет текущего пользователя. До входа (Фаза 2) — цвет по умолчанию;
      // после входа значение перезаписывается из сессии.
      style={{ '--person-color': PERSON_HEX.iris } as CSSProperties}
    >
      <AnimatePresence mode="wait" initial={false}>
        <Outlet key={location.pathname} />
      </AnimatePresence>

      {!hidesTabBar(location.pathname) && <TabBar />}
    </div>
  );
}
