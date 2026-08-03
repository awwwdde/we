import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';

import { DateCard } from '@/components/DateCard';
import { Screen } from '@/components/layout/Screen';
import { fetchDates } from '@/lib/api/dates';
import { spring } from '@/lib/motion/presets';

export function HistoryScreen() {
  const dates = useQuery({ queryKey: ['dates'], queryFn: () => fetchDates() });

  return (
    <Screen title="История">
      {dates.isPending && <p className="text-caption text-mist">Загружаю…</p>}

      {dates.isError && (
        <p className="text-caption text-mist">Не удалось загрузить ленту.</p>
      )}

      {dates.data?.items.length === 0 && (
        <p className="text-body text-mist">Здесь появятся прошедшие свидания.</p>
      )}

      <ul className="flex flex-col gap-3">
        {dates.data?.items.map((plan, i) => (
          <motion.li
            key={plan.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            // Ступенчатое появление списка (ТЗ 8.1).
            transition={{ ...spring.soft, delay: Math.min(i * 0.04, 0.3) }}
          >
            <DateCard plan={plan} />
          </motion.li>
        ))}
      </ul>
    </Screen>
  );
}
