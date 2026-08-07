import { z } from 'zod';

import { api } from '@/lib/api/client';

/**
 * Внутренняя лента уведомлений (ТЗ 13.6).
 *
 * Push не гарантирован — на iOS его не будет вовсе до установки на домашний
 * экран, — поэтому те же события лежат на сервере и читаются отсюда.
 */

export const notificationKindSchema = z.enum([
  'invite_sent',
  'invite_opened',
  'confirmed',
  'declined',
  'cancelled',
  'reminder_24h',
  'reminder_2h',
]);

export const notificationSchema = z.object({
  id: z.string().uuid(),
  kind: notificationKindSchema,
  title: z.string(),
  body: z.string(),
  url: z.string(),
  created_at: z.string(),
  read_at: z.string().nullable(),
});

export const notificationFeedSchema = z.object({
  items: z.array(notificationSchema),
  unread: z.number(),
});

export type NotificationKind = z.infer<typeof notificationKindSchema>;
export type AppNotification = z.infer<typeof notificationSchema>;
export type NotificationFeed = z.infer<typeof notificationFeedSchema>;

export function fetchNotifications() {
  return api('/notifications', { schema: notificationFeedSchema });
}

export function markNotificationsRead() {
  return api('/notifications/read', { method: 'POST' });
}
