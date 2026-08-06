import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Плашка «Доступно обновление» (ТЗ 14.2).
 *
 * `registerType: 'prompt'` выбран намеренно: новая версия не должна
 * перезагружать экран под руками — человек мог быть в середине создания
 * свидания. Обновляемся только по явному нажатию.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      className="glass fixed left-1/2 z-50 flex w-[calc(100%-40px)] max-w-[420px]
                 -translate-x-1/2 items-center gap-3 rounded-card px-4 py-3"
      style={{ bottom: 'calc(96px + env(safe-area-inset-bottom))' }}
    >
      <span className="flex-1 text-caption text-chalk">Доступно обновление</span>
      <button
        type="button"
        onClick={() => void updateServiceWorker(true)}
        className="min-h-tap rounded-pill px-4 text-caption font-medium text-coal"
        style={{ background: 'var(--person-color)' }}
      >
        Обновить
      </button>
      <button
        type="button"
        onClick={() => setNeedRefresh(false)}
        aria-label="Отложить"
        className="min-h-tap min-w-tap text-caption text-mist"
      >
        Позже
      </button>
    </div>
  );
}
