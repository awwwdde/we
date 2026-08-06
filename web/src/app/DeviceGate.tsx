import { useEffect, useState, type ReactNode } from 'react';

import { OrbField } from '@/components/orb/OrbField';

/**
 * Приложение открывается только на телефоне.
 *
 * Это отклонение от ТЗ 20, где сказано «должно не разваливаться на широком
 * экране — этого достаточно». Заказчик попросил жёсткую заглушку: приложение
 * приватное, ставится на домашний экран, и десктопного сценария у него нет.
 *
 * Как определяем. По одной ширине нельзя: телефон в альбомной ориентации
 * шире 900px, а узкое окно браузера на десктопе — уже нет. Поэтому смотрим
 * на три признака сразу:
 *   • `pointer: coarse` — основной ввод пальцем, а не мышью;
 *   • `hover: none` — наведения не существует;
 *   • короткая сторона окна < 600px — отсекает планшеты (у iPad mini 744).
 */
const PHONE_MAX_SHORT_SIDE = 600;

function detectPhone(): boolean {
  const shortSide = Math.min(window.innerWidth, window.innerHeight);

  // В dev достаточно узкого окна: отлаживать удобнее в браузере на ПК через
  // эмуляцию устройства (F12), а она не всегда включает эмуляцию тача.
  // В прод-бандл эта ветка не попадает — Vite вырезает её по `import.meta.env.DEV`.
  if (import.meta.env.DEV) return shortSide < PHONE_MAX_SHORT_SIDE;

  const touchPrimary =
    window.matchMedia('(pointer: coarse)').matches &&
    window.matchMedia('(hover: none)').matches;

  return touchPrimary && shortSide < PHONE_MAX_SHORT_SIDE;
}

function useIsPhone(): boolean {
  const [isPhone, setIsPhone] = useState(detectPhone);

  useEffect(() => {
    // Поворот экрана и изменение размера окна меняют вердикт.
    const update = () => setIsPhone(detectPhone());
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return isPhone;
}

function UnsupportedDevice() {
  return (
    <div className="relative min-h-[100dvh] bg-coal">
      <OrbField state="apart" className="fixed" />

      <main className="screen relative mx-auto flex min-h-[100dvh] max-w-[34rem] flex-col justify-center">
        <p className="font-mono text-label uppercase text-mist">Перигей</p>
        <h1 className="mt-4 font-display text-display-l uppercase">
          На этом устройстве не работает
        </h1>
        <p className="mt-4 max-w-[34ch] text-body text-linen">
          Откройте с телефона — приложение сделано для мобильного экрана
          и ставится на домашний экран.
        </p>
      </main>
    </div>
  );
}

/**
 * Пускает дальше только с телефона.
 *
 * Стоит выше роутера: на неподдерживаемом устройстве не монтируются ни
 * экраны, ни запросы к API.
 */
export function DeviceGate({ children }: { children: ReactNode }) {
  return useIsPhone() ? <>{children}</> : <UnsupportedDevice />;
}
