import { z } from 'zod';

import { api } from '@/lib/api/client';
import { personColorSchema } from '@/lib/api/schemas';

/** Схемы свиданий и мест — они же рантайм-проверка ответов API. */

export const dateStatusSchema = z.enum([
  'draft',
  'pending',
  'confirmed',
  'declined',
  'cancelled',
  'done',
]);

export const placeSourceSchema = z.enum(['yandex', 'twogis', 'kudago', 'custom']);

export const placeSnapshotSchema = z.object({
  source: placeSourceSchema,
  external_id: z.string().nullable().optional(),
  name: z.string(),
  category: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  lat: z.number().nullable().optional(),
  lon: z.number().nullable().optional(),
  photo_url: z.string().nullable().optional(),
});

const personBriefSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string(),
  color: personColorSchema,
});

export const datePlanSchema = z.object({
  id: z.string().uuid(),
  status: dateStatusSchema,
  scheduled_at: z.string(),
  is_all_day: z.boolean(),
  note: z.string().nullable(),
  place: placeSnapshotSchema,
  author: personBriefSchema,
  guest: personBriefSchema,
  created_at: z.string(),
  confirmed_at: z.string().nullable(),
});

export const datePageSchema = z.object({
  items: z.array(datePlanSchema),
  next_cursor: z.string().nullable(),
});

export const customPlaceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  category: z.string().nullable(),
  address: z.string().nullable(),
  lat: z.number().nullable(),
  lon: z.number().nullable(),
  note: z.string().nullable(),
  created_at: z.string(),
});

export type DateStatus = z.infer<typeof dateStatusSchema>;
export type PlaceSnapshot = z.infer<typeof placeSnapshotSchema>;
export type DatePlan = z.infer<typeof datePlanSchema>;
export type CustomPlace = z.infer<typeof customPlaceSchema>;

// ── Запросы ──────────────────────────────────────────────────────────────────

export function fetchDates(params: { status?: DateStatus; cursor?: string } = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.cursor) query.set('cursor', params.cursor);
  const suffix = query.toString() ? `?${query}` : '';
  return api(`/dates${suffix}`, { schema: datePageSchema });
}

export function fetchUpcoming() {
  return api('/dates/upcoming', { schema: datePlanSchema.nullable() });
}

export function fetchDate(id: string) {
  return api(`/dates/${id}`, { schema: datePlanSchema });
}

export type DateDraftPayload = {
  scheduled_at: string;
  is_all_day: boolean;
  note: string | null;
  place: PlaceSnapshot;
};

export function createDate(payload: DateDraftPayload) {
  return api('/dates', { method: 'POST', body: payload, schema: datePlanSchema });
}

export function cancelDate(id: string) {
  return api(`/dates/${id}/cancel`, { method: 'POST', schema: datePlanSchema });
}

export function deleteDate(id: string) {
  return api(`/dates/${id}`, { method: 'DELETE' });
}

export function fetchCustomPlaces() {
  return api('/places/custom', { schema: z.array(customPlaceSchema) });
}

export function createCustomPlace(payload: { name: string; category?: string; address?: string }) {
  return api('/places/custom', { method: 'POST', body: payload, schema: customPlaceSchema });
}
