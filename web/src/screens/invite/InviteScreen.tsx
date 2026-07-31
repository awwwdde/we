import { useParams } from 'react-router-dom';

import { Screen } from '@/components/layout/Screen';

/** Публичный экран приглашения. Конверт и опросник — Фаза 6. */
export function InviteScreen() {
  const { token } = useParams<{ token: string }>();

  return (
    <Screen title="Приглашение" withTabBar={false}>
      <p className="text-body text-mist">Приглашение откроется здесь в Фазе 6.</p>
      <p className="mt-2 font-mono text-label uppercase text-ghost">token: {token}</p>
    </Screen>
  );
}
