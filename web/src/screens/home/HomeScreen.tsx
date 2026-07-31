import { Screen } from '@/components/layout/Screen';
import { Orb } from '@/components/orb/Orb';

export function HomeScreen() {
  return (
    <Screen>
      {/* Две сферы порознь — состояние «свиданий нет» (ТЗ 5.4).
          Дрейф по орбитам подключается в Фазе 8. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[60dvh] overflow-hidden">
        <Orb color="ember" size={260} style={{ position: 'absolute', top: 40, left: -60 }} />
        <Orb color="iris" size={300} style={{ position: 'absolute', top: 160, right: -80 }} />
      </div>

      <div className="relative flex min-h-[70dvh] flex-col justify-end">
        <p className="font-mono text-label uppercase text-mist">Сегодня</p>
        <h1 className="mt-3 font-display text-display-xl uppercase">Пока пусто</h1>
        <p className="mt-3 max-w-[28ch] text-body text-mist">
          Ближайшее свидание появится здесь, как только его подтвердят.
        </p>
      </div>
    </Screen>
  );
}
