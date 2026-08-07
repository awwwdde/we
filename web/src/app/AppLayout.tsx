import { AnimatePresence } from 'framer-motion';
import type { CSSProperties } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import { StandaloneGate } from '@/app/StandaloneGate';
import { OfflineNotice } from '@/components/OfflineNotice';
import { TabBar } from '@/components/layout/TabBar';
import { UpdatePrompt } from '@/components/pwa/UpdatePrompt';
import { PERSON_VAR } from '@/types/person';

/** Маршруты, на которых таббар скрыт (ТЗ 6.2). */
function hidesTabBar(pathname: string): boolean {
  return pathname.startsWith('/create') || pathname.startsWith('/i/') || pathname === '/onboarding';
}

export function AppLayout() {
  const location = useLocation();

  return (
    <div
      className="relative min-h-[100dvh] bg-coal"
      // Цвет текущего пользователя. Значение перезаписывается после входа
      // в Providers, здесь — запасное на время загрузки.
      style={{ '--person-color': PERSON_VAR.iris } as CSSProperties}
    >
      <StandaloneGate>
        <OfflineNotice />

        <AnimatePresence mode="wait" initial={false}>
          <Outlet key={location.pathname} />
        </AnimatePresence>

        {!hidesTabBar(location.pathname) && <TabBar />}
        <UpdatePrompt />
      </StandaloneGate>
    </div>
  );
}
