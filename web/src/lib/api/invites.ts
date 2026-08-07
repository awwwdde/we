import { z } from 'zod';

import { api } from '@/lib/api/client';
import { personColorSchema } from '@/lib/api/schemas';
import { placeSnapshotSchema } from '@/lib/api/dates';

/** Приглашение: отправка автором и публичный ответ. */

export const sendResultSchema = z.object({
  token: z.string(),
  url: z.string(),
  expires_at: z.string(),
});

export const invitePublicSchema = z.object({
  author_name: z.string(),
  author_color: personColorSchema,
  scheduled_at: z.string(),
  is_all_day: z.boolean(),
  note: z.string().nullable(),
  place: placeSnapshotSchema,
  answered: z.boolean(),
  accepted: z.boolean(),
});

export type InvitePublic = z.infer<typeof invitePublicSchema>;

export function sendInvite(dateId: string) {
  return api(`/dates/${dateId}/send`, { method: 'POST', schema: sendResultSchema });
}

/**
 * Публичные вызовы. `skipRefresh` обязателен: экран открывают без сессии,
 * и попытка обновить её увела бы человека в ошибку вместо приглашения.
 */
export function fetchInvite(token: string) {
  return api(`/invites/${token}`, { schema: invitePublicSchema, skipRefresh: true });
}

export function respondToInvite(token: string, accepted: boolean, evadeCount: number) {
  return api(`/invites/${token}/respond`, {
    method: 'POST',
    body: { accepted, evade_count: evadeCount },
    schema: invitePublicSchema,
    skipRefresh: true,
  });
}
