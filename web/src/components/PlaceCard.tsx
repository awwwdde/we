import type { PlaceDto } from '@/lib/api/dates';
import { PERSON_VAR, type PersonColor } from '@/types/person';

/**
 * Карточка места (макет, раздел 04, шаг 3).
 *
 * Источник помечается моно-чипом, а не иконкой: так одинаково читается
 * для kudago, osm, 2gis и custom, и не нужно рисовать логотипы.
 * Свои места идут первыми и обводятся цветом человека.
 */

const SOURCE_LABEL: Record<PlaceDto['source'], string> = {
  custom: 'наше',
  kudago: 'kudago',
  osm: 'osm',
  twogis: '2gis',
  yandex: 'yandex',
};

function formatDistance(metres: number | null | undefined): string | null {
  if (metres == null) return null;
  return metres < 1000 ? `${Math.round(metres)} м` : `${(metres / 1000).toFixed(1)} км`;
}

function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

/** Короткая правая подпись: даты события или режим работы. */
function formatWhen(place: PlaceDto): string | null {
  const dates = place.event_dates ?? [];
  if (dates.length > 0) {
    const last = dates.at(-1);
    return last ? `до ${formatEventDate(last)}` : null;
  }
  return place.schedule?.raw ?? null;
}

type PlaceCardProps = {
  place: PlaceDto;
  selected: boolean;
  onSelect: () => void;
  /** Цвет текущего пользователя — им обводятся «наши» места. */
  personColor?: PersonColor;
};

export function PlaceCard({ place, selected, onSelect, personColor = 'ember' }: PlaceCardProps) {
  const own = place.source === 'custom';
  const distance = formatDistance(place.distance_m);
  const when = formatWhen(place);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="flex w-full items-stretch gap-3 overflow-hidden rounded-tile bg-surface p-3 text-left"
      style={{
        border: '1px solid',
        borderColor: selected
          ? 'var(--person-color)'
          : own
            ? PERSON_VAR[personColor]
            : 'var(--stroke)',
      }}
    >
      {place.photo_url ? (
        <img
          src={place.photo_url}
          alt=""
          loading="lazy"
          decoding="async"
          width={72}
          height={72}
          className="h-[72px] w-[72px] shrink-0 rounded-cell object-cover"
        />
      ) : (
        <div
          aria-hidden
          className="h-[72px] w-[72px] shrink-0 rounded-cell"
          style={{
            background: `radial-gradient(circle at 40% 40%, ${PERSON_VAR[personColor]}, transparent 72%)`,
            opacity: 0.32,
          }}
        />
      )}

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="rounded-pill bg-surface2 px-2 py-[3px] font-mono text-label uppercase text-mist">
            {SOURCE_LABEL[place.source]}
          </span>
          <span className="font-mono text-label uppercase text-ghost">{place.category}</span>
        </span>

        <span className="mt-1 block truncate text-body text-chalk">{place.name}</span>

        {(distance || when) && (
          <span className="mt-1 block truncate text-caption text-mist">
            {[distance, when].filter(Boolean).join(' · ')}
          </span>
        )}
      </span>
    </button>
  );
}
