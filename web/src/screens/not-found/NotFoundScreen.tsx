import { Link } from 'react-router-dom';

import { Screen } from '@/components/layout/Screen';

export function NotFoundScreen() {
  return (
    <Screen title="Не найдено" withTabBar={false}>
      <p className="text-body text-mist">Такой страницы нет.</p>
      <Link
        to="/"
        className="mt-6 inline-flex min-h-tap items-center rounded-pill bg-surface2 px-6 text-body"
      >
        На главную
      </Link>
    </Screen>
  );
}
