import { api } from '@/lib/api/client';
import { z } from 'zod';

/**
 * Подписка на уведомления (ТЗ 13.2).
 *
 * Порядок вызовов критичен и нарушать его нельзя:
 *   1. только в standalone — в обычной вкладке iOS подписка не создастся;
 *   2. разрешение запрашивается **только по тапу** — вызов при загрузке
 *      страницы Safari молча отклоняет;
 *   3. и лишь затем сама подписка.
 */

const vapidSchema = z.object({ public_key: z.string() });
const statusSchema = z.object({ configured: z.boolean(), subscriptions: z.number() });

export type PushStatus = z.infer<typeof statusSchema>;

/** Почему подписка невозможна — текстом, который не стыдно показать. */
export type PushBlocker =
  | 'unsupported'
  | 'not-standalone'
  | 'denied'
  | 'not-configured'
  | null;

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Легаси-флаг Safari: на iOS до сих пор единственный надёжный признак.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * `applicationServerKey` принимает `Uint8Array`, а ключ приходит
 * base64url-строкой. Без преобразования будет `InvalidCharacterError`.
 */
function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(normalized);
  // Возвращаем именно ArrayBuffer: тип Uint8Array в свежих lib.dom
  // параметризован буфером и не подходит под BufferSource напрямую.
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}

export function fetchPushStatus() {
  return api('/push/status', { schema: statusSchema });
}

/** Подписать это устройство. Возвращает причину отказа или `null` при успехе. */
export async function subscribeToPush(): Promise<PushBlocker> {
  if (!isPushSupported()) return 'unsupported';

  // 1. Только в standalone (ТЗ 13.2). В браузерной вкладке на iOS
  //    подписка не создастся вовсе.
  if (!isStandalone()) return 'not-standalone';

  // 2. Разрешение — строго по тапу пользователя.
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';

  let key: string;
  try {
    key = (await api('/push/vapid-public-key', { schema: vapidSchema })).public_key;
  } catch {
    return 'not-configured';
  }

  // 3. Сама подписка.
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    // Обязателен, иначе браузер откажет.
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(key),
  });

  await api('/push/subscribe', { method: 'POST', body: subscription.toJSON() });
  return null;
}

export async function unsubscribeFromPush(): Promise<void> {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  await api('/push/unsubscribe', { method: 'POST', body: { endpoint: subscription.endpoint } });
  await subscription.unsubscribe();
}

export function sendTestPush() {
  return api('/push/test', { method: 'POST' });
}
