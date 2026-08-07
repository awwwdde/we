import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { STATUS_LABEL, statusClass } from '@/components/DateCard';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { cancelDate, deleteDate, fetchDate } from '@/lib/api/dates';
import { sendInvite } from '@/lib/api/invites';
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

  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const date = useQuery({ queryKey: ['date', id], queryFn: () => fetchDate(id), enabled: !!id });

  /**
   * Отдать ссылку системным share-sheet, с запасным копированием в буфер.
   * Ссылку заодно показываем на экране: если share-sheet закрыть, она
   * должна остаться доступной, а не пропасть.
   */
  const share = async (url: string): Promise<void> => {
    setLink(url);
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Перигей', text: 'Кое-что задумано', url });
        return;
      } catch {
        // Закрыли share-sheet — не ошибка, копируем.
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
  };

  const send = useMutation({
    mutationFn: () => sendInvite(id),
    onSuccess: async (result) => {
      navigator.vibrate?.(30);
      await share(result.url);
      void queryClient.invalidateQueries({ queryKey: ['date', id] });
      void queryClient.invalidateQueries({ queryKey: ['dates'] });
    },
  });

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

          {/* Ссылка остаётся на экране после отправки: закрытый share-sheet
              не должен уносить её с собой. */}
          {link && (
            <div className="mt-6 rounded-card border border-stroke bg-surface p-4">
              <p className="font-mono text-label uppercase text-mist">Ссылка-приглашение</p>
              <p className="mt-2 break-all font-mono text-caption text-chalk">{link}</p>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(link);
                  setCopied(true);
                }}
                className="mt-3 min-h-tap text-caption text-mist underline-offset-4 hover:underline"
              >
                {copied ? 'Скопировано' : 'Скопировать'}
              </button>
            </div>
          )}

          {!finished && (
            <div className="mt-8 flex flex-col gap-3">
              {plan.status === 'draft' && (
                <>
                  <Button onClick={() => send.mutate()} loading={send.isPending}>
                    Отправить приглашение
                  </Button>
                  <Button variant="ghost" onClick={() => remove.mutate()} loading={remove.isPending}>
                    Удалить черновик
                  </Button>
                </>
              )}

              {/* Уже отправленное можно отправить ещё раз — сервер отдаст
                  ту же ссылку, новое приглашение не создаётся. */}
              {plan.status === 'pending' && (
                <Button variant="ghost" onClick={() => send.mutate()} loading={send.isPending}>
                  {link ? 'Показать ссылку ещё раз' : 'Получить ссылку снова'}
                </Button>
              )}

              {plan.status !== 'draft' && (
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
