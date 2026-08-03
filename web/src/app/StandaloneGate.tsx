import { useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

import { isStandalone } from '@/lib/pwa/standalone';
import { InstallScreen } from '@/screens/onboarding/InstallScreen';

/**
 * Пускает дальше только приложение, запущенное с домашнего экрана (ТЗ 2.1).
 *
 * Исключение — публичная ссылка-приглашение `/i/:token`. Её открывают из
 * мессенджера в обычной вкладке, и требовать там установку значило бы
 * сломать сценарий ТЗ 2.3, где второй человек просто переходит по ссылке.
 */
function isPublicLink(pathname: string): boolean {
  return pathname.startsWith('/i/');
}

export function StandaloneGate({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  // Режим отображения не меняется за время жизни страницы: переход в
  // standalone — это всегда новый запуск приложения.
  const [standalone] = useState(isStandalone);

  // В dev-сборке экран установки только мешает: отлаживать удобнее в
  // браузере на ПК через эмуляцию устройства (F12). В прод-бандл эта ветка
  // не попадает — Vite вырезает её вместе с `import.meta.env.DEV`.
  if (import.meta.env.DEV) return <>{children}</>;

  if (standalone || isPublicLink(pathname)) return <>{children}</>;
  return <InstallScreen />;
}
