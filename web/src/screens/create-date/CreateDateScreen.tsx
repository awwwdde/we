import { Screen } from '@/components/layout/Screen';

/** Мастер создания свидания. Шаги (дата → время → место → записка → превью) — Фаза 4. */
export function CreateDateScreen() {
  return (
    <Screen title="Задумать" withTabBar={false}>
      <p className="text-body text-mist">Мастер создания свидания появится в Фазе 4.</p>
    </Screen>
  );
}
