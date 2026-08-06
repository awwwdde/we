import { Link } from 'react-router-dom';

import type { DatePlan, DateStatus } from '@/lib/api/dates';
import { formatDayShort, formatTime, utcToZoned } from '@/lib/time';
import { PERSON_VAR } from '@/types/person';

/** Подписи статусов (ТЗ 7.5). */
const STATUS_LABEL: Record<DateStatus, string> = {
  draft: 'черновик',
  pending: 'ждёт ответа',
  confirmed: 'подтверждено',
  declined: 'отказ',
  cancelled: 'отменено',
  done: 'прошло',
};

/**
 * Цвет статуса.
 *
 * `lime` появляется ровно в одном случае — свидание подтверждено.
 * Как только он окажется где-то ещё, подтверждение перестанет читаться
 * мгновенно.
 */
function statusClass(status: DateStatus): string {
  if (status === 'confirmed') return 'text-lime';
  if (status === 'done' || status === 'cancelled' || status === 'declined') return 'text-ghost';
  return 'text-mist';
}

/**
 * Карточка в ленте (макет, раздел 05).
 *
 * Полоса автора осталась, но стала 4px и без свечения: в списке важнее
 * ритм, чем эффект.
 */
export function DateCard({ plan }: { plan: DatePlan }) {
  const when = utcToZoned(plan.scheduled_at);

  return (
    <Link
      to={`/date/${plan.id}`}
      className="relative flex flex-col overflow-hidden rounded-card bg-surface py-4 pl-5 pr-4"
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: PERSON_VAR[plan.author.color] }}
      />

      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-label uppercase text-mist">
          {formatDayShort(when)} · {plan.is_all_day ? 'весь день' : formatTime(when)}
        </span>
        <span className={`font-mono text-label uppercase ${statusClass(plan.status)}`}>
          {STATUS_LABEL[plan.status]}
        </span>
      </div>

      <p className="mt-2 text-title">{plan.place.name}</p>
      {plan.note && <p className="mt-1 text-caption text-linen">{plan.note}</p>}
    </Link>
  );
}

export { STATUS_LABEL, statusClass };
