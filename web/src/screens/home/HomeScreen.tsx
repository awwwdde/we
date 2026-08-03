import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { Screen } from '@/components/layout/Screen';
import { OrbField } from '@/components/orb/OrbField';
import { fetchUpcoming } from '@/lib/api/dates';
import { formatDayLong, formatTime, utcToZoned } from '@/lib/time';

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

export function HomeScreen() {
  const upcoming = useQuery({ queryKey: ['upcoming'], queryFn: fetchUpcoming });
  const plan = upcoming.data ?? null;
  const when = plan ? utcToZoned(plan.scheduled_at) : null;
  const countdown = useCountdown(when);

  return (
    <>
      {/* Слиты — когда свидание подтверждено, порознь — когда его нет (ТЗ 5.4). */}
      <OrbField state={plan ? 'merged' : 'apart'} className="fixed" />

      <Screen>
        <div className="relative flex min-h-[76dvh] flex-col justify-end">
          {plan && when ? (
            <>
              <p className="font-mono text-label uppercase text-lime">Подтверждено</p>
              <p className="mt-4 font-mono text-title tabular-nums text-chalk">{countdown}</p>
              <h1 className="mt-2 font-display text-display-xl uppercase first-letter:uppercase">
                {formatDayLong(when)}
              </h1>
              <p className="mt-3 text-body text-mist">
                {plan.is_all_day ? 'весь день' : formatTime(when)} · {plan.place.name}
              </p>
              <Link
                to={`/date/${plan.id}`}
                className="mt-6 inline-flex min-h-tap items-center self-start rounded-pill
                           bg-surface2 px-6 text-body"
              >
                Подробнее
              </Link>
            </>
          ) : (
            <>
              <p className="font-mono text-label uppercase text-mist">Сегодня</p>
              <h1 className="mt-3 font-display text-display-xl uppercase">Пока пусто</h1>
              <p className="mt-3 max-w-[28ch] text-body text-mist">
                Ближайшее свидание появится здесь, как только его подтвердят.
              </p>
              <Link
                to="/create"
                className="mt-6 inline-flex min-h-tap items-center self-start rounded-pill
                           px-6 text-body text-void"
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
