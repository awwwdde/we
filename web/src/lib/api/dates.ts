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

export const placeSourceSchema = z.enum(['yandex', 'osm', 'twogis', 'kudago', 'custom']);

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

export const weatherSchema = z.object({
  temp_c: z.number(),
  code: z.number(),
  description: z.string(),
  precipitation_chance: z.number().nullable(),
  /** Прогноз из кэша: Open-Meteo не ответил. */
  stale: z.boolean(),
});

export type Weather = z.infer<typeof weatherSchema>;

/**
 * Прогноз на дату свидания. `null` — прогноза нет, и это нормально:
 * у своего места может не быть координат, а дальше 16 суток погоду
 * не знает никто.
 */
export function fetchWeather(id: string) {
  return api(`/dates/${id}/weather`, { schema: weatherSchema.nullable() });
}

export function cancelDate(id: string) {
  return api(`/dates/${id}/cancel`, { method: 'POST', schema: datePlanSchema });
}

export function deleteDate(id: string) {
  return api(`/dates/${id}`, { method: 'DELETE' });
}

export const placeDtoSchema = z.object({
  source: placeSourceSchema,
  external_id: z.string(),
  name: z.string(),
  category: z.string(),
  address: z.string().nullable().optional(),
  lat: z.number().nullable().optional(),
  lon: z.number().nullable().optional(),
  photo_url: z.string().nullable().optional(),
  schedule: z.object({ raw: z.string().nullable().optional() }).nullable().optional(),
  event_dates: z.array(z.string()).nullable().optional(),
  url: z.string().nullable().optional(),
  distance_m: z.number().nullable().optional(),
});

export const placeSearchSchema = z.object({
  items: z.array(placeDtoSchema),
  /** Хотя бы один источник ответил из просроченного кэша (ТЗ 12.4). */
  stale: z.boolean(),
  sources: z.array(placeSourceSchema),
});

export type PlaceDto = z.infer<typeof placeDtoSchema>;

/** Координаты центра Москвы — запасной вариант, если геолокация недоступна. */
export const MOSCOW = { lat: 55.7558, lon: 37.6173 } as const;

export function searchPlaces(params: {
  q?: string;
  category?: string;
  lat?: number;
  lon?: number;
  radius?: number;
}) {
  const query = new URLSearchParams();
  if (params.q) query.set('q', params.q);
  if (params.category) query.set('category', params.category);
  query.set('lat', String(params.lat ?? MOSCOW.lat));
  query.set('lon', String(params.lon ?? MOSCOW.lon));
  if (params.radius) query.set('radius', String(params.radius));
  return api(`/places/search?${query}`, { schema: placeSearchSchema });
}

export function fetchCategories() {
  return api('/places/categories', { schema: z.array(z.string()) });
}

export function fetchCustomPlaces() {
  return api('/places/custom', { schema: z.array(customPlaceSchema) });
}

export function createCustomPlace(payload: { name: string; category?: string; address?: string }) {
  return api('/places/custom', { method: 'POST', body: payload, schema: customPlaceSchema });
}
