import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// В docker-compose api доступен по имени сервиса, локально — по localhost.
const apiTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8000';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': new URL('./src', import.meta.url).pathname },
  },
  server: {
    port: 5173,
    // Прокси на бэкенд: фронт всегда ходит на относительный `/api`,
    // поэтому в проде ничего менять не нужно — там тот же путь через Nginx.
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
    },
  },
});
