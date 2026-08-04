import type { PlaceDto } from '@/lib/api/dates';

/**
 * Карточка места (ТЗ 7.4).
 *
 * Показывает фото (если есть), название, категорию, адрес, расстояние
 * и режим работы. Источник данных помечается маленьким значком — так видно,
 * откуда место.
 */

const SOURCE_LABEL: Record<PlaceDto['source'], string> = {
  osm: 'OSM',
  kudago: 'KudaGo',
  twogis: '2ГИС',
  yandex: 'Яндекс',
  custom: 'Наше',
};

function formatDistance(metres: number | null | undefined): string | null {
  if (metres == null) return null;
  return metres < 1000 ? `${Math.round(metres)} м` : `${(metres / 1000).toFixed(1)} км`;
}

function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

type PlaceCardProps = {
  place: PlaceDto;
  selected: boolean;
  onSelect: () => void;
};

export function PlaceCard({ place, selected, onSelect }: PlaceCardProps) {
  const distance = formatDistance(place.distance_m);
  const dates = place.event_dates ?? [];

  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'flex w-full gap-3 overflow-hidden rounded-card border p-3 text-left transition-colors',
        selected ? 'border-transparent bg-surface2' : 'border-stroke bg-surface',
      ].join(' ')}
    >
      {place.photo_url && (
        <img
          src={place.photo_url}
          alt=""
          loading="lazy"
          decoding="async"
          width={64}
          height={64}
          className="h-16 w-16 shrink-0 rounded-2xl object-cover"
        />
      )}

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="truncate text-body text-chalk">{place.name}</span>
          <span className="shrink-0 font-mono text-label uppercase text-ghost">
            {SOURCE_LABEL[place.source]}
          </span>
        </span>

        <span className="mt-1 flex flex-wrap items-center gap-x-2 font-mono text-label uppercase text-mist">
          <span>{place.category}</span>
          {distance && <span className="text-ghost">· {distance}</span>}
        </span>

        {place.address && (
          <span className="mt-1 block truncate text-caption text-mist">{place.address}</span>
        )}

        {place.schedule?.raw && (
          <span className="mt-1 block truncate text-caption text-ghost">
            {place.schedule.raw}
          </span>
        )}

        {/* Даты события — то, чего нет у справочников организаций (ТЗ 12.8). */}
        {dates.length > 0 && (
          <span className="mt-1 block text-caption text-mist">
            {dates.length === 1
              ? formatEventDate(dates[0]!)
              : `${formatEventDate(dates[0]!)} — ${formatEventDate(dates[dates.length - 1]!)}`}
          </span>
        )}
      </span>
    </button>
  );
}
