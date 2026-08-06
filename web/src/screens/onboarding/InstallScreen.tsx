import type { ReactNode } from 'react';

import { Screen } from '@/components/layout/Screen';
import { OrbField } from '@/components/orb/OrbField';
import { detectPlatform, isIosSafari } from '@/lib/pwa/standalone';

/**
 * Экран установки на домашний экран (ТЗ 2.1).
 *
 * Показывается, пока приложение открыто во вкладке браузера. Дальше пройти
 * нельзя, и это не каприз: в обычной вкладке на iOS не создаётся подписка
 * на уведомления (ТЗ 13.6), а вход по passkey в standalone работает иначе.
 */

type StepProps = { n: number; children: ReactNode };

function Step({ n, children }: StepProps) {
  return (
    <li className="flex gap-4">
      <span className="font-mono text-label uppercase text-ghost pt-1">0{n}</span>
      <span className="flex-1 text-body text-chalk">{children}</span>
    </li>
  );
}

function Highlight({ children }: { children: ReactNode }) {
  return <span className="text-chalk underline decoration-ghost underline-offset-4">{children}</span>;
}

export function InstallScreen() {
  const platform = detectPlatform();
  const iosSafari = isIosSafari();

  return (
    <>
      <OrbField state="apart" className="fixed" />

      <Screen withTabBar={false}>
        <div className="relative flex min-h-[86dvh] flex-col justify-end gap-8">
          <div>
            <p className="font-mono text-label uppercase text-mist">Перигей</p>
            <h1 className="mt-3 font-display text-display-l uppercase">
              Поставьте на домашний экран
            </h1>
            <p className="mt-3 max-w-[32ch] text-body text-linen">
              Приложение работает только так: из вкладки браузера не приходят
              уведомления и не открывается полноэкранный режим.
            </p>
          </div>

          {platform === 'ios' && iosSafari && (
            <ol className="flex flex-col gap-4">
              <Step n={1}>
                Нажмите <Highlight>«Поделиться»</Highlight> — квадрат со стрелкой
                вверх внизу экрана
              </Step>
              <Step n={2}>
                Пролистайте и выберите <Highlight>«На экран „Домой“»</Highlight>
              </Step>
              <Step n={3}>
                Нажмите <Highlight>«Добавить»</Highlight> и откройте Перигей
                с домашнего экрана
              </Step>
            </ol>
          )}

          {platform === 'ios' && !iosSafari && (
            <div className="rounded-card border border-stroke bg-surface p-5">
              <p className="text-body text-chalk">Откройте эту ссылку в Safari.</p>
              <p className="mt-2 text-caption text-mist">
                На iPhone добавить приложение на домашний экран умеет только
                Safari — в других браузерах такого пункта в меню нет.
              </p>
            </div>
          )}

          {platform === 'android' && (
            <ol className="flex flex-col gap-4">
              <Step n={1}>
                Откройте меню <Highlight>⋮</Highlight> в правом верхнем углу
              </Step>
              <Step n={2}>
                Выберите <Highlight>«Установить приложение»</Highlight> или
                <Highlight> «Добавить на главный экран»</Highlight>
              </Step>
              <Step n={3}>
                Подтвердите и откройте Перигей с главного экрана
              </Step>
            </ol>
          )}

          {platform === 'other' && (
            <div className="rounded-card border border-stroke bg-surface p-5">
              <p className="text-body text-chalk">Откройте с телефона.</p>
              <p className="mt-2 text-caption text-mist">
                Перигей ставится на домашний экран iPhone или Android.
              </p>
            </div>
          )}
        </div>
      </Screen>
    </>
  );
}
