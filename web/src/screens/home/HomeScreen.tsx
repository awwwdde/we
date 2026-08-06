import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { Screen } from '@/components/layout/Screen';
import { OrbField } from '@/components/orb/OrbField';
import { fetchUpcoming } from '@/lib/api/dates';
import { formatDayLong, formatTime, formatWeekday, utcToZoned } from '@/lib/time';

/** Обратный отсчёт до свидания, обновляется раз в минуту. */
function useCountdown(target: Date | null): string | null {
  const [, tick] = useState(0);

  useEffect(() => {
    if (!target) return;
    const timer = window.setInterval(() => tick((n) => n + 1), 60_000);
    return () => window.clearInterval(timer);
  }, [target]);

  if (!target) return null;

  const diff = target.getTime() - Date.now();
  if (diff <= 0) return 'сейчас';

  const minutes = Math.floor(diff / 60_000);
  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);

  if (days > 0) return `${days} д ${hours} ч`;
  if (hours > 0) return `${hours} ч ${minutes % 60} мин`;
  return `${minutes} мин`;
}

/**
 * Главный экран, вариант «сфера-герой» (макет, раздел 03-1a).
 *
 * Отсчёт живёт внутри слитой сферы, дата — самый крупный элемент экрана.
 * `lime` появляется ровно дважды: чип статуса и обводка кольца орбиты.
 */
export function HomeScreen() {
  const upcoming = useQuery({ queryKey: ['upcoming'], queryFn: fetchUpcoming });
  const plan = upcoming.data ?? null;
  const when = plan ? utcToZoned(plan.scheduled_at) : null;
  const countdown = useCountdown(when);

  return (
    <>
      {/* Слиты — когда свидание подтверждено, порознь — когда его нет. */}
      <OrbField state={plan ? 'merged' : 'apart'} className="fixed">
        {plan && (
          <div className="text-center">
            <p className="font-mono text-title tabular-nums text-chalk">{countdown}</p>
            <p className="mt-1 font-mono text-label uppercase text-mist">до встречи</p>
          </div>
        )}
      </OrbField>

      <Screen>
        <div className="relative flex min-h-[76dvh] flex-col justify-end">
          {plan && when ? (
            <>
              <p className="font-mono text-label uppercase text-mist">Ближайшее</p>

              <span
                className="mt-4 inline-flex w-fit items-center rounded-pill px-3 py-1
                           font-mono text-label uppercase text-lime"
                style={{ border: '1px solid color-mix(in srgb, var(--lime) 40%, transparent)' }}
              >
                Подтверждено
              </span>

              <h1 className="mt-4 font-display text-display-xl uppercase first-letter:uppercase">
                {formatDayLong(when)}
              </h1>

              <p className="mt-2 text-body text-linen first-letter:uppercase">
                {formatWeekday(when)} · {plan.is_all_day ? 'весь день' : formatTime(when)}
              </p>
              <p className="mt-1 text-body text-chalk">{plan.place.name}</p>

              <p className="mt-4 font-mono text-label uppercase text-mist">
                Задумал(а) {plan.author.display_name}
              </p>

              <Link
                to={`/date/${plan.id}`}
                className="mt-6 inline-flex min-h-tap w-fit items-center rounded-pill
                           border border-stroke px-6 text-body text-chalk"
              >
                Подробнее
              </Link>
            </>
          ) : (
            <>
              <p className="font-mono text-label uppercase text-mist">Перигей</p>
              <h1 className="mt-3 font-display text-display-xl uppercase">Пока пусто</h1>
              <p className="mt-3 max-w-[28ch] text-body text-linen">
                Подозрительно тихо. Кто-то же должен начать.
              </p>
              <Link
                to="/create"
                className="mt-8 inline-flex min-h-tap w-fit items-center rounded-pill
                           px-6 text-body text-coal"
                style={{ background: 'var(--person-color)' }}
              >
                Задумать свидание
              </Link>
            </>
          )}
        </div>
      </Screen>
    </>
  );
}
