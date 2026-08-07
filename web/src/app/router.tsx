import { Suspense, lazy, type ReactNode } from 'react';
import { createBrowserRouter } from 'react-router-dom';

import { AppLayout } from '@/app/AppLayout';
import { Providers } from '@/app/Providers';
import { RequireAuth } from '@/app/RequireAuth';
const CreateDateScreen = lazy(() =>
  import('@/screens/create-date/CreateDateScreen').then((m) => ({ default: m.CreateDateScreen })),
);
const DateScreen = lazy(() =>
  import('@/screens/date/DateScreen').then((m) => ({ default: m.DateScreen })),
);
const HistoryScreen = lazy(() =>
  import('@/screens/history/HistoryScreen').then((m) => ({ default: m.HistoryScreen })),
);
import { HomeScreen } from '@/screens/home/HomeScreen';
const InviteScreen = lazy(() =>
  import('@/screens/invite/InviteScreen').then((m) => ({ default: m.InviteScreen })),
);
import { NotFoundScreen } from '@/screens/not-found/NotFoundScreen';
const NotificationsScreen = lazy(() =>
  import('@/screens/notifications/NotificationsScreen').then((m) => ({
    default: m.NotificationsScreen,
  })),
);
import { OnboardingScreen } from '@/screens/onboarding/OnboardingScreen';
const SettingsScreen = lazy(() =>
  import('@/screens/settings/SettingsScreen').then((m) => ({ default: m.SettingsScreen })),
);

/**
 * Экран догружается отдельным чанком (ТЗ 15.5: стартовый бандл < 200 КБ).
 * Пока чанк едет — пустой фон в цвете приложения, а не белая вспышка.
 */
const load = (element: ReactNode) => (
  <Suspense fallback={<div className="min-h-[100dvh] bg-coal" aria-busy="true" />}>
    {element}
  </Suspense>
);

const guard = (element: ReactNode) => <RequireAuth>{load(element)}</RequireAuth>;

/** Карта маршрутов (ТЗ 6.1). */
export const router = createBrowserRouter([
  {
    element: (
      <Providers>
        <AppLayout />
      </Providers>
    ),
    errorElement: <NotFoundScreen />,
    children: [
      // Публичные: онбординг и приглашение по ссылке.
      { path: '/onboarding', element: <OnboardingScreen /> },
      { path: '/i/:token', element: load(<InviteScreen />) },

      { path: '/', element: guard(<HomeScreen />) },
      { path: '/create', element: guard(<CreateDateScreen />) },
      { path: '/date/:id', element: guard(<DateScreen />) },
      { path: '/history', element: guard(<HistoryScreen />) },
      // Сверх карты ТЗ 6.1: внутренняя лента событий, которой требует
      // ТЗ 13.6. Пятым пунктом в таббар не идёт — вход с главного экрана.
      { path: '/notifications', element: guard(<NotificationsScreen />) },
      { path: '/settings', element: guard(<SettingsScreen />) },

      { path: '*', element: <NotFoundScreen /> },
    ],
  },
]);
