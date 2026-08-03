import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';

import { STATUS_LABEL, statusClass } from '@/components/DateCard';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { cancelDate, deleteDate, fetchDate } from '@/lib/api/dates';
import { formatDayLong, formatTime, formatWeekday, utcToZoned } from '@/lib/time';
import { PERSON_HEX } from '@/types/person';

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
        <p className="text-body text-mist">Свидание не найдено.</p>
      </Screen>
    );
  }

  const plan = date.data;
  const when = utcToZoned(plan.scheduled_at);
  const finished = plan.status === 'cancelled' || plan.status === 'done';

  return (
    <Screen>
      <div
        className="rounded-card border border-stroke bg-surface p-6"
        style={{ boxShadow: `0 0 40px -18px ${PERSON_HEX[plan.author.color]}` }}
      >
        <p className={`font-mono text-label uppercase ${statusClass(plan.status)}`}>
          {STATUS_LABEL[plan.status]}
        </p>

        <h1 className="mt-4 font-display text-display-xl uppercase first-letter:uppercase">
          {formatDayLong(when)}
        </h1>
        <p className="mt-2 text-body text-mist first-letter:uppercase">
          {formatWeekday(when)} · {plan.is_all_day ? 'весь день' : formatTime(when)}
        </p>

        <div className="mt-6 border-t border-stroke pt-4">
          <p className="font-mono text-label uppercase text-mist">Место</p>
          <p className="mt-1 text-body">{plan.place.name}</p>
          {plan.place.address && (
            <p className="mt-1 text-caption text-mist">{plan.place.address}</p>
          )}
        </div>

        {plan.note && (
          <div className="mt-4 border-t border-stroke pt-4">
            <p className="font-mono text-label uppercase text-mist">Записка</p>
            <p className="mt-1 text-body">{plan.note}</p>
          </div>
        )}

        <div className="mt-6 flex items-center gap-2 border-t border-stroke pt-4">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: PERSON_HEX[plan.author.color] }}
            aria-hidden
          />
          <span className="text-caption text-mist">задумал(а) {plan.author.display_name}</span>
        </div>
      </div>

      {!finished && (
        <div className="mt-6 flex flex-col gap-3">
          {plan.status === 'draft' && (
            <Button variant="ghost" onClick={() => remove.mutate()} loading={remove.isPending}>
              Удалить черновик
            </Button>
          )}
          <Button variant="ghost" onClick={() => cancel.mutate()} loading={cancel.isPending}>
            Отменить свидание
          </Button>
        </div>
      )}
    </Screen>
  );
}
