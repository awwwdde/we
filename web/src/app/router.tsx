import { createBrowserRouter } from 'react-router-dom';

import { AppLayout } from '@/app/AppLayout';
import { NotFoundScreen } from '@/screens/not-found/NotFoundScreen';
import { CreateDateScreen } from '@/screens/create-date/CreateDateScreen';
import { DateScreen } from '@/screens/date/DateScreen';
import { HistoryScreen } from '@/screens/history/HistoryScreen';
import { HomeScreen } from '@/screens/home/HomeScreen';
import { InviteScreen } from '@/screens/invite/InviteScreen';
import { OnboardingScreen } from '@/screens/onboarding/OnboardingScreen';
import { SettingsScreen } from '@/screens/settings/SettingsScreen';

/**
 * Карта маршрутов (ТЗ 6.1).
 *
 * Защита маршрутов через <RequireAuth> появляется в Фазе 2 вместе с сессиями —
 * сейчас защищать нечем, поэтому обёртки нет, а не есть пустая заглушка.
 */
export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    errorElement: <NotFoundScreen />,
    children: [
      { path: '/onboarding', element: <OnboardingScreen /> },
      { path: '/', element: <HomeScreen /> },
      { path: '/create', element: <CreateDateScreen /> },
      { path: '/date/:id', element: <DateScreen /> },
      { path: '/history', element: <HistoryScreen /> },
      { path: '/settings', element: <SettingsScreen /> },
      { path: '/i/:token', element: <InviteScreen /> },
      { path: '*', element: <NotFoundScreen /> },
    ],
  },
]);
