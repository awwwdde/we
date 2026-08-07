import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';

import { Screen } from '@/components/layout/Screen';
import {
  fetchNotifications,
  markNotificationsRead,
  type AppNotification,
} from '@/lib/api/notifications';
import { spring, staggerDelay } from '@/lib/motion/presets';
import { formatDayShort, formatTime, utcToZoned } from '@/lib/time';

/**
 * Лента событий (ТЗ 13.6).
 *
 * Это второй канал, а не украшение: push на iOS появляется только после
 * установки на домашний экран и даже потом доставляется как повезёт.
 * Здесь событие лежит всегда.
 *
 * Композиция взята у «Истории» — в макете «Тёплая ночь и одна орбита»
 * отдельного раздела для ленты нет, а изобретать второй язык для списка
 * в приложении из семи экранов незачем.
 */
function when(item: AppNotification): string {
  const moment = utcToZoned(item.created_at);
  return `${formatDayShort(moment)} · ${formatTime(moment)}`;
}

export function NotificationsScreen() {
  const reduced = useReducedMotion() ?? false;
  const queryClient = useQueryClient();
  const feed = useQuery({ queryKey: ['notifications'], queryFn: fetchNotifications });

  const read = useMutation({
    mutationFn: markNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  // Открыл экран — прочитал. Отметку шлём один раз и только если есть что
  // отмечать, иначе каждое фоновое обновление списка дёргало бы сервер.
  const unread = feed.data?.unread ?? 0;
  const markRead = read.mutate;
  useEffect(() => {
    if (unread > 0) markRead();
  }, [unread, markRead]);

  return (
    <Screen title="События">
      {feed.isPending && <p className="text-caption text-mist">Загружаю…</p>}

      {/* Ошибка видна, только если показывать больше нечего: при неудачном
          фоновом обновлении прежние данные остаются на экране. */}
      {feed.isError && !feed.data && (
        <p className="text-caption text-mist">Не удалось загрузить события.</p>
      )}

      {feed.data?.items.length === 0 && (
        <p className="text-body text-linen">Пока ничего не происходило.</p>
      )}

      <ul className="flex flex-col gap-3">
        {feed.data?.items.map((item, i) => (
          <motion.li
            key={item.id}
            initial={{ opacity: 0, y: reduced ? 0 : 12 }}
            animate={{ opacity: 1, y: 0 }}
            // Ступенчатое появление списка (ТЗ 8.1).
            transition={{ ...spring.soft, delay: staggerDelay(i, reduced) }}
          >
            <Link
              to={item.url}
              className="flex min-h-tap flex-col justify-center rounded-tile border border-stroke
                         bg-surface px-4 py-3"
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-mono text-label uppercase text-mist">{item.title}</p>
                <span className="shrink-0 font-mono text-label tabular-nums text-ghost">
                  {when(item)}
                </span>
              </div>

              <p className="mt-2 text-body text-chalk">{item.body}</p>
            </Link>
          </motion.li>
        ))}
      </ul>
    </Screen>
  );
}
