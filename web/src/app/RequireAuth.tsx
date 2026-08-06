import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useSession } from '@/lib/auth/session';

/**
 * Защита маршрутов (ТЗ 6.1).
 *
 * Пока сессия восстанавливается по refresh-cookie, ничего не показываем:
 * мигнуть онбордингом и тут же увести на главную — хуже, чем короткая пауза.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const status = useSession((s) => s.status);
  const location = useLocation();

  if (status === 'unknown') {
    return <div className="min-h-[100dvh] bg-coal" aria-busy="true" />;
  }

  if (status === 'anonymous') {
    // Исходный путь сохраняем, чтобы вернуть человека туда, куда он шёл.
    return <Navigate to="/onboarding" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
