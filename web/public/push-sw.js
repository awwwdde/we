/* eslint-disable no-undef */
/**
 * Обработчики web-push для Service Worker (ТЗ 13.3).
 *
 * Подключается через `workbox.importScripts` к сгенерированному SW —
 * так кэширование остаётся на Workbox, а push живёт отдельным файлом.
 */

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'Перигей', body: event.data.text() };
  }

  // `waitUntil` обязателен: без него SW уснёт до того, как покажет
  // уведомление (ТЗ 13.3).
  event.waitUntil(
    self.registration.showNotification(data.title || 'Перигей', {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      data: { url: data.url || '/' },
      vibrate: [12, 40, 12],
      // Склеивает повторные уведомления одного смысла.
      tag: data.tag || 'perigee',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((list) => {
        // Уже открытое окно переиспользуем, а не плодим вкладки.
        const open = list.find((c) => c.url.includes(self.location.origin));
        if (open) return open.focus().then((c) => c.navigate(url));
        return clients.openWindow(url);
      }),
  );
});
