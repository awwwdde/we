import { Screen } from '@/components/layout/Screen';

/** Устройства, уведомления, коды восстановления. Наполняется в Фазе 2 и 7. */
export function SettingsScreen() {
  return (
    <Screen title="Настройки">
      <p className="text-body text-mist">
        Привязанные устройства и уведомления появятся вместе с входом по passkey.
      </p>
    </Screen>
  );
}
