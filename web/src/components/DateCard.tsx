import { Link } from 'react-router-dom';

import type { DatePlan, DateStatus } from '@/lib/api/dates';
import { formatDayLong, formatTime, utcToZoned } from '@/lib/time';
import { PERSON_HEX } from '@/types/person';

/** Подписи статусов (ТЗ 7.5). */
const STATUS_LABEL: Record<DateStatus, string> = {
  draft: 'Черновик',
  pending: 'Ждёт ответа',
  confirmed: 'Подтверждено',
  declined: 'Отказ',
  cancelled: 'Отменено',
  done: 'Прошло',
};

/**
 * Цвет статуса.
 *
 * `lime` появляется ровно в одном случае — свидание подтверждено (ТЗ 5.1).
 * Как только он окажется где-то ещё, подтверждение перестанет читаться мгновенно.
 */
function statusClass(status: DateStatus): string {
  if (status === 'confirmed') return 'text-lime';
  if (status === 'done' || status === 'cancelled' || status === 'declined') return 'text-ghost';
  return 'text-mist';
}

export function DateCard({ plan }: { plan: DatePlan }) {
  const when = utcToZoned(plan.scheduled_at);
  const authorColor = PERSON_HEX[plan.author.color];

  return (
    <Link
      to={`/date/${plan.id}`}
      className="relative flex gap-4 overflow-hidden rounded-card bg-surface p-4"
    >
      {/* Вертикальная полоса цвета автора: авторство читается до текста (ТЗ 7.5). */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: authorColor }}
      />

      <div className="flex-1 pl-2">
        <p className="font-mono text-label uppercase text-mist">
          {plan.is_all_day ? 'Весь день' : formatTime(when)}
        </p>
        <p className="mt-1 font-display text-title uppercase first-letter:uppercase">
          {formatDayLong(when)}
        </p>
        <p className="mt-1 text-body text-chalk">{plan.place.name}</p>
        {plan.note && <p className="mt-2 text-caption text-mist">{plan.note}</p>}
      </div>

      <span className={`font-mono text-label uppercase ${statusClass(plan.status)}`}>
        {STATUS_LABEL[plan.status]}
      </span>
    </Link>
  );
}

export { STATUS_LABEL, statusClass };
