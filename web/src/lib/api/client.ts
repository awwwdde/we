import type { ZodType } from 'zod';

import { accessSchema, apiErrorSchema } from '@/lib/api/schemas';

/**
 * HTTP-клиент.
 *
 * Access-токен живёт только в памяти модуля — не в localStorage, откуда его
 * достал бы любой XSS (ТЗ 9.6). Refresh лежит в httpOnly-cookie, JS его
 * не видит вообще.
 *
 * На 401 клиент делает ровно один запрос обновления и повторяет исходный.
 * Параллельные 401 объединяются промис-синглтоном, иначе десять запросов
 * подряд устроили бы десять ротаций refresh и погасили бы цепочку.
 */

const BASE = '/api';

// Заголовок обязателен для изменяющих состояние запросов (ТЗ 16, CSRF).
const BASE_HEADERS: Readonly<Record<string, string>> = {
  'Content-Type': 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
};

let accessToken: string | null = null;
let refreshInFlight: Promise<string | null> | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  let code = 'ERROR';
  let message = 'Что-то пошло не так';
  try {
    const parsed = apiErrorSchema.safeParse(await response.json());
    if (parsed.success) {
      code = parsed.data.error.code;
      message = parsed.data.error.message;
    }
  } catch {
    // Тело не JSON — оставляем текст по умолчанию.
  }
  return new ApiError(code, message, response.status);
}

/** Обновление сессии. Параллельные вызовы получают один и тот же промис. */
export function refreshSession(): Promise<string | null> {
  refreshInFlight ??= (async () => {
    try {
      const response = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: BASE_HEADERS,
        credentials: 'include',
      });
      if (!response.ok) {
        accessToken = null;
        return null;
      }
      const data = accessSchema.parse(await response.json());
      accessToken = data.access_token;
      return accessToken;
    } catch {
      accessToken = null;
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

type RequestOptions<T> = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Схема ответа. Без неё тело не читается (для 204). */
  schema?: ZodType<T>;
  /** Не пытаться обновлять сессию — для самих эндпоинтов входа. */
  skipRefresh?: boolean;
};

async function send(path: string, options: RequestOptions<unknown>): Promise<Response> {
  const headers: Record<string, string> = { ...BASE_HEADERS };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  return fetch(`${BASE}${path}`, {
    method: options.method ?? 'GET',
    headers,
    credentials: 'include',
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
}

export async function api<T = void>(path: string, options: RequestOptions<T> = {}): Promise<T> {
  let response = await send(path, options);

  if (response.status === 401 && !options.skipRefresh) {
    const renewed = await refreshSession();
    if (renewed) response = await send(path, options);
  }

  if (!response.ok) throw await toApiError(response);

  if (!options.schema) return undefined as T;
  return options.schema.parse(await response.json());
}
