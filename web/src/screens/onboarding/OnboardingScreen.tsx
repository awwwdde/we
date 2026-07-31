import { Screen } from '@/components/layout/Screen';

/** Установка PWA, инвайт-код, passkey, push. Наполняется в Фазах 2–3. */
export function OnboardingScreen() {
  return (
    <Screen title="Orbit" withTabBar={false}>
      <p className="text-body text-mist">
        Установка на домашний экран и вход по passkey появятся в Фазах 2–3.
      </p>
    </Screen>
  );
}
