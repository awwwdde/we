import { startAuthentication, startRegistration } from '@simplewebauthn/browser';

import { ApiError, api } from '@/lib/api/client';
import {
  authenticationOptionsSchema,
  registerVerifySchema,
  registrationOptionsSchema,
  sessionSchema,
} from '@/lib/api/schemas';

/**
 * Passkey: создание и вход (ТЗ 9.4, 9.5).
 *
 * Опции приходят с сервера как есть и передаются браузеру без правок —
 * challenge и rp.id формирует только бэкенд.
 */

/** Поддерживает ли устройство WebAuthn вообще (ТЗ 9.2). */
export function isPasskeySupported(): boolean {
  return typeof window !== 'undefined' && window.PublicKeyCredential !== undefined;
}

export class PasskeyCancelled extends Error {
  constructor() {
    super('Отменено');
    this.name = 'PasskeyCancelled';
  }
}

/** Пользователь закрыл системный диалог — это не ошибка, а решение. */
function isCancellation(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'NotAllowedError' || error.name === 'AbortError')
  );
}

/** Привязать первый или очередной passkey по одноразовому коду. */
export async function registerPasskey(inviteCode: string, deviceLabel: string | null) {
  // Сервер отдаёт PublicKeyCredentialCreationOptions как есть.
  const options = await api('/auth/register/options', {
    method: 'POST',
    body: { invite_code: inviteCode },
    schema: registrationOptionsSchema,
    skipRefresh: true,
  });

  let credential;
  try {
    credential = await startRegistration({ optionsJSON: options });
  } catch (error) {
    if (isCancellation(error)) throw new PasskeyCancelled();
    throw error;
  }

  return api('/auth/register/verify', {
    method: 'POST',
    body: { credential, device_label: deviceLabel },
    schema: registerVerifySchema,
    skipRefresh: true,
  });
}

/** Вход без ввода логина: система сама предложит нужный passkey. */
export async function loginWithPasskey() {
  const options = await api('/auth/login/options', {
    method: 'POST',
    schema: authenticationOptionsSchema,
    skipRefresh: true,
  });

  let credential;
  try {
    credential = await startAuthentication({ optionsJSON: options });
  } catch (error) {
    if (isCancellation(error)) throw new PasskeyCancelled();
    throw error;
  }

  return api('/auth/login/verify', {
    method: 'POST',
    body: { credential },
    schema: sessionSchema,
    skipRefresh: true,
  });
}

/** Вход по коду восстановления, когда все устройства потеряны (ТЗ 9.7). */
export async function loginWithRecoveryCode(code: string) {
  return api('/auth/recovery', {
    method: 'POST',
    body: { code },
    schema: sessionSchema,
    skipRefresh: true,
  });
}

export { ApiError };
