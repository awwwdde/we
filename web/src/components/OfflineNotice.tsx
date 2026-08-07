import { useEffect, useState } from 'react';

/**
 * Признак офлайна (ТЗ 14.3).
 *
 * `navigator.onLine` врёт в одну сторону: `false` означает «связи точно нет»,
 * а `true` — лишь «сетевой интерфейс поднят». Для нашей задачи этого хватает:
 * мы не блокируем интерфейс, а объясняем, почему данные могли устареть.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  return online;
}

/**
 * Полоска офлайна.
 *
 * Экран не подменяется целиком: последние загруженные свидания лежат
 * в кэше Service Worker и остаются читаемыми — это и есть осмысленный
 * офлайн из ТЗ 14.3. Сферы при этом замирают.
 */
export function OfflineNotice() {
  const online = useOnline();
  if (online) return null;

  return (
    <div
      role="status"
      className="glass fixed left-1/2 z-50 -translate-x-1/2 rounded-pill px-4 py-2"
      style={{ top: 'calc(8px + env(safe-area-inset-top))' }}
    >
      <span className="font-mono text-label uppercase text-mist">
        Нет связи. Показываю, что помню
      </span>
    </div>
  );
}
