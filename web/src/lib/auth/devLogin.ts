import { api } from '@/lib/api/client';
import { sessionSchema } from '@/lib/api/schemas';

/**
 * Вход без passkey — только для отладки в браузере на ПК.
 *
 * WebAuthn требует настоящего биометрического ключа, которого у десктопа нет,
 * поэтому проверять сценарии внутри приложения иначе невозможно.
 *
 * Три независимых замка, чтобы это никогда не сработало на проде:
 *   1. `import.meta.env.DEV` — в прод-бандле кода нет вовсе;
 *   2. `DEV_AUTH_ENABLED` на сервере — по умолчанию выключено;
 *   3. `config.py` не даёт поднять приложение с этим флагом на HTTPS-домене.
 */

export const DEV_LOGIN_AVAILABLE = import.meta.env.DEV;

/** Логины из CLI: `vlad` (ember) и `angelina` (iris). */
export async function devLogin(username: string) {
  return api('/auth/dev-login', {
    method: 'POST',
    body: { username },
    schema: sessionSchema,
    skipRefresh: true,
  });
}
