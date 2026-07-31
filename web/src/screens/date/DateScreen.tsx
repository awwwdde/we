import { useParams } from 'react-router-dom';

import { Screen } from '@/components/layout/Screen';

/** Карточка свидания. Наполняется в Фазе 4. */
export function DateScreen() {
  const { id } = useParams<{ id: string }>();

  return (
    <Screen title="Свидание">
      <p className="text-body text-mist">Карточка свидания появится в Фазе 4.</p>
      <p className="mt-2 font-mono text-label uppercase text-ghost">id: {id}</p>
    </Screen>
  );
}
