import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';

import { useSession } from '@/lib/auth/session';
import { PERSON_HEX } from '@/types/person';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Данных мало и меняются они редко — лишние перезапросы ни к чему.
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Провайдеры приложения.
 *
 * Здесь же однократно восстанавливается сессия по refresh-cookie и
 * выставляется цвет текущего пользователя, которым подсвечен весь интерфейс.
 */
export function Providers({ children }: { children: ReactNode }) {
  const restore = useSession((s) => s.restore);
  const user = useSession((s) => s.user);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    if (restored) return;
    setRestored(true);
    void restore();
  }, [restore, restored]);

  useEffect(() => {
    const color = user ? PERSON_HEX[user.color] : PERSON_HEX.iris;
    document.documentElement.style.setProperty('--person-color', color);
  }, [user]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
