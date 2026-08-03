import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import { z } from 'zod';

/**
 * Zod-схемы ответов API.
 *
 * Они же — рантайм-валидация: если бэкенд однажды поменяет форму ответа,
 * это всплывёт явной ошибкой здесь, а не «undefined» где-то в разметке.
 */

export const personColorSchema = z.enum(['ember', 'iris']);

export const userSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  display_name: z.string(),
  color: personColorSchema,
});

export const sessionSchema = z.object({
  access_token: z.string(),
  user: userSchema,
});

export const accessSchema = z.object({
  access_token: z.string(),
});

export const registerVerifySchema = z.object({
  user: userSchema,
  recovery_codes: z.array(z.string()),
});

export const deviceSchema = z.object({
  id: z.string().uuid(),
  device_label: z.string().nullable(),
  created_at: z.string(),
  last_used_at: z.string().nullable(),
});

export const deviceListSchema = z.array(deviceSchema);

export const deviceInviteSchema = z.object({
  code: z.string(),
  expires_at: z.string(),
});

/**
 * Опции WebAuthn.
 *
 * Разбирать их поле за полем смысла нет: структура задана стандартом,
 * формирует её только наш сервер, и уходит она нетронутой прямо в браузер.
 * Проверяем лишь то, что это объект с challenge — иначе диалог всё равно
 * не откроется, и лучше упасть с понятной ошибкой здесь.
 */
const looksLikeOptions = (value: unknown): boolean =>
  typeof value === 'object' && value !== null && 'challenge' in value;

export const registrationOptionsSchema = z.custom<PublicKeyCredentialCreationOptionsJSON>(
  looksLikeOptions,
  { message: 'Сервер вернул некорректные опции passkey' },
);

export const authenticationOptionsSchema = z.custom<PublicKeyCredentialRequestOptionsJSON>(
  looksLikeOptions,
  { message: 'Сервер вернул некорректные опции passkey' },
);

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export type User = z.infer<typeof userSchema>;
export type Device = z.infer<typeof deviceSchema>;
export type DeviceInvite = z.infer<typeof deviceInviteSchema>;
