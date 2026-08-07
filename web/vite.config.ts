import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// В docker-compose api доступен по имени сервиса, локально — по localhost.
const apiTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8000';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Не перезагружаем экран под руками: при новой версии показывается
      // аккуратная плашка с кнопкой (ТЗ 14.2).
      registerType: 'prompt',
      includeAssets: ['icons/apple-touch-icon-180.png'],

      manifest: {
        name: 'Перигей',
        short_name: 'Перигей',
        description: 'Свидания для двоих',
        lang: 'ru',
        start_url: '/?source=pwa',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0B0908',
        theme_color: '#0B0908',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          // Без maskable Android обрежет иконку по кругу и срежет края.
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },

      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg}'],
        globIgnores: ['push-sw.js'],
        cleanupOutdatedCaches: true,
        // Обработчики push живут отдельным файлом: кэширование остаётся
        // за Workbox, а свой код не приходится вписывать в генерируемый SW.
        importScripts: ['/push-sw.js'],
        // Запросы к API никогда не должны отдаваться из precache-оболочки.
        navigateFallbackDenylist: [/^\/api\//, /^\/healthz$/],
        runtimeCaching: [
          {
            // Шрифты неизменны — берём из кэша сразу (ТЗ 14.2).
            urlPattern: ({ request }) => request.destination === 'font',
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts',
              expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            // Фото мест приходят со сторонних доменов (Фаза 5).
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'place-photos',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            // Свидания читаются офлайн из кэша, если сеть не ответила за 3с.
            urlPattern: ({ url, request }) =>
              request.method === 'GET' && url.pathname.startsWith('/api/dates'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-dates',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 50 },
            },
          },
          {
            urlPattern: ({ url, request }) =>
              request.method === 'GET' && url.pathname.startsWith('/api/places'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-places',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 50 },
            },
          },
        ],
      },

      devOptions: {
        // В dev service worker мешает HMR — включаем только осознанно.
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: { '@': new URL('./src', import.meta.url).pathname },
  },
  server: {
    port: 5173,
    // Фронт всегда ходит на относительный `/api`, поэтому в проде ничего
    // менять не нужно — там тот же путь внутри одного контейнера.
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
    },
  },
});
