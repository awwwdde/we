import type { ReactNode } from 'react';
import { createBrowserRouter } from 'react-router-dom';

import { AppLayout } from '@/app/AppLayout';
import { Providers } from '@/app/Providers';
import { RequireAuth } from '@/app/RequireAuth';
import { CreateDateScreen } from '@/screens/create-date/CreateDateScreen';
import { DateScreen } from '@/screens/date/DateScreen';
import { HistoryScreen } from '@/screens/history/HistoryScreen';
import { HomeScreen } from '@/screens/home/HomeScreen';
import { InviteScreen } from '@/screens/invite/InviteScreen';
import { NotFoundScreen } from '@/screens/not-found/NotFoundScreen';
import { OnboardingScreen } from '@/screens/onboarding/OnboardingScreen';
import { SettingsScreen } from '@/screens/settings/SettingsScreen';

const guard = (element: ReactNode) => <RequireAuth>{element}</RequireAuth>;

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
      { path: '/i/:token', element: <InviteScreen /> },

      { path: '/', element: guard(<HomeScreen />) },
      { path: '/create', element: guard(<CreateDateScreen />) },
      { path: '/date/:id', element: guard(<DateScreen />) },
      { path: '/history', element: guard(<HistoryScreen />) },
      { path: '/settings', element: guard(<SettingsScreen />) },

      { path: '*', element: <NotFoundScreen /> },
    ],
  },
]);
