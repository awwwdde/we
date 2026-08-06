import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';

import { DateCard } from '@/components/DateCard';
import { Screen } from '@/components/layout/Screen';
import { fetchDates, type DatePlan } from '@/lib/api/dates';
import { spring } from '@/lib/motion/presets';
import { formatMonthYear, utcToZoned } from '@/lib/time';

/** Свидания, сгруппированные по месяцу (макет, раздел 05). */
function groupByMonth(items: DatePlan[]): { month: string; items: DatePlan[] }[] {
  const groups: { month: string; items: DatePlan[] }[] = [];

  for (const plan of items) {
    const month = formatMonthYear(utcToZoned(plan.scheduled_at));
    const last = groups.at(-1);
    // Лента уже отсортирована по дате, поэтому достаточно сравнить
    // с последней группой — перебирать все не нужно.
    if (last && last.month === month) last.items.push(plan);
    else groups.push({ month, items: [plan] });
  }

  return groups;
}

export function HistoryScreen() {
  const dates = useQuery({ queryKey: ['dates'], queryFn: () => fetchDates() });
  const groups = dates.data ? groupByMonth(dates.data.items) : [];

  return (
    <Screen title="История">
      {dates.isPending && <p className="text-caption text-mist">Загружаю…</p>}

      {dates.isError && <p className="text-caption text-mist">Не удалось загрузить ленту.</p>}

      {dates.data?.items.length === 0 && (
        <p className="text-body text-linen">Здесь появятся прошедшие свидания.</p>
      )}

      <div className="flex flex-col gap-8">
        {groups.map((group, groupIndex) => (
          <section key={group.month}>
            <h2 className="mb-3 font-mono text-label uppercase text-mist first-letter:uppercase">
              {group.month}
            </h2>

            <ul className="flex flex-col gap-3">
              {group.items.map((plan, i) => (
                <motion.li
                  key={plan.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  // Ступенчатое появление списка (ТЗ 8.1).
                  transition={{ ...spring.soft, delay: Math.min((groupIndex * 3 + i) * 0.04, 0.3) }}
                >
                  <DateCard plan={plan} />
                </motion.li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Screen>
  );
}
