import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';

import { STATUS_LABEL, statusClass } from '@/components/DateCard';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { cancelDate, deleteDate, fetchDate } from '@/lib/api/dates';
import { formatDayLong, formatTime, formatWeekday, splitDate, utcToZoned } from '@/lib/time';
import { PERSON_VAR } from '@/types/person';

/**
 * Карточка свидания (макет, раздел 05).
 *
 * Дата в две строки: на 390px это самый крупный элемент, который влезает
 * без переносов внутри слова. Сверху — обрезанная сфера цвета автора:
 * авторство читается до текста.
 */
export function DateScreen() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const date = useQuery({ queryKey: ['date', id], queryFn: () => fetchDate(id), enabled: !!id });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['dates'] });
    void queryClient.invalidateQueries({ queryKey: ['upcoming'] });
  };

  const cancel = useMutation({
    mutationFn: () => cancelDate(id),
    onSuccess: () => {
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ['date', id] });
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteDate(id),
    onSuccess: () => {
      invalidate();
      navigate('/history', { replace: true });
    },
  });

  if (date.isPending) {
    return (
      <Screen title="Свидание">
        <p className="text-caption text-mist">Загружаю…</p>
      </Screen>
    );
  }

  if (date.isError || !date.data) {
    return (
      <Screen title="Свидание">
        <p className="text-body text-linen">Свидание не найдено.</p>
      </Screen>
    );
  }

  const plan = date.data;
  const when = utcToZoned(plan.scheduled_at);
  const { day, month } = splitDate(when);
  const finished = plan.status === 'cancelled' || plan.status === 'done';
  const authorColor = PERSON_VAR[plan.author.color];

  return (
    <>
      {/* Сфера обрезана сверху и подписывает авторство цветом. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-[42dvh] overflow-hidden"
      >
        <div
          className="absolute left-1/2 top-0 h-[58vw] w-[58vw] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background: `radial-gradient(circle at 50% 55%, ${authorColor}, transparent 68%)`,
            filter: 'blur(calc(58vw * var(--orb-blur-scale)))',
            opacity: 'var(--orb-opacity)',
          }}
        />
      </div>

      <Screen>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="relative -ml-2 mb-6 min-h-tap min-w-tap text-mist"
          aria-label="Назад"
        >
          ‹
        </button>

        <div className="relative">
          <p className={`font-mono text-label uppercase ${statusClass(plan.status)}`}>
            {STATUS_LABEL[plan.status]}
          </p>

          <p className="mt-6 text-body text-linen first-letter:uppercase">{formatWeekday(when)}</p>

          {/* Дата в две строки — самый крупный элемент экрана. */}
          <h1 className="mt-1 font-display text-display-xl uppercase leading-[0.95]">
            {day}
            <br />
            {month}
          </h1>

          <p className="mt-4 font-mono text-title tabular-nums text-chalk">
            {plan.is_all_day ? 'весь день' : formatTime(when)}
          </p>

          <section className="mt-8 border-t border-stroke pt-5">
            <p className="font-mono text-label uppercase text-mist">Место</p>
            <p className="mt-2 text-title">{plan.place.name}</p>
            {plan.place.address && (
              <p className="mt-1 text-body text-linen">{plan.place.address}</p>
            )}
          </section>

          {plan.note && (
            <section className="mt-6 border-t border-stroke pt-5">
              <p className="font-mono text-label uppercase text-mist">Записка</p>
              <p className="mt-2 text-body text-linen">{plan.note}</p>
            </section>
          )}

          <p className="mt-8 flex items-center gap-2 font-mono text-label uppercase text-mist">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: authorColor }}
              aria-hidden
            />
            Задумал(а) {plan.author.display_name}
            {plan.confirmed_at &&
              ` · подтверждено ${formatDayLong(utcToZoned(plan.confirmed_at))}`}
          </p>

          {!finished && (
            <div className="mt-8 flex flex-col gap-3">
              {plan.status === 'draft' ? (
                <Button variant="ghost" onClick={() => remove.mutate()} loading={remove.isPending}>
                  Удалить черновик
                </Button>
              ) : (
                <Button variant="ghost" onClick={() => cancel.mutate()} loading={cancel.isPending}>
                  Отменить свидание
                </Button>
              )}
            </div>
          )}
        </div>
      </Screen>
    </>
  );
}
