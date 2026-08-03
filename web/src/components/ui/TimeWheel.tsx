import { useEffect, useRef } from 'react';

/**
 * Барабан в стиле iOS (ТЗ 7.2).
 *
 * Реализация — обычный `overflow-y: scroll` со `scroll-snap-type: y mandatory`,
 * без библиотек. Позицию читаем по остановке скролла: событие `scrollend`
 * есть не везде, поэтому подстраховываемся таймером.
 */

const ITEM_HEIGHT = 44; // не меньше зоны нажатия (ТЗ 15.2)
const VISIBLE = 5;

type ColumnProps = {
  values: readonly number[];
  value: number;
  onChange: (value: number) => void;
  label: string;
};

function Column({ values, value, onChange, label }: ColumnProps) {
  const ref = useRef<HTMLDivElement>(null);
  const settle = useRef<number | undefined>(undefined);

  // Прокручиваем к выбранному значению при монтировании и внешних изменениях.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const index = values.indexOf(value);
    if (index < 0) return;

    const target = index * ITEM_HEIGHT;
    if (Math.abs(el.scrollTop - target) > 1) el.scrollTop = target;
  }, [value, values]);

  const handleScroll = () => {
    const el = ref.current;
    if (!el) return;

    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      const index = Math.round(el.scrollTop / ITEM_HEIGHT);
      const next = values[Math.min(Math.max(index, 0), values.length - 1)];
      if (next !== undefined && next !== value) {
        onChange(next);
        // Отклик на остановке барабана (ТЗ 7.2, 15.4).
        navigator.vibrate?.(10);
      }
    }, 120);
  };

  return (
    <div className="relative flex-1">
      <div
        ref={ref}
        onScroll={handleScroll}
        aria-label={label}
        className="no-scrollbar overflow-y-scroll"
        style={{
          height: ITEM_HEIGHT * VISIBLE,
          scrollSnapType: 'y mandatory',
          // Пустые отступы сверху и снизу, чтобы крайние значения могли
          // встать в центр.
          paddingTop: ITEM_HEIGHT * Math.floor(VISIBLE / 2),
          paddingBottom: ITEM_HEIGHT * Math.floor(VISIBLE / 2),
        }}
      >
        {values.map((item) => (
          <div
            key={item}
            style={{ height: ITEM_HEIGHT, scrollSnapAlign: 'center' }}
            className={[
              'flex items-center justify-center font-mono text-title tabular-nums transition-colors',
              item === value ? 'text-chalk' : 'text-ghost',
            ].join(' ')}
          >
            {`${item}`.padStart(2, '0')}
          </div>
        ))}
      </div>
    </div>
  );
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5); // шаг 5 минут

type TimeWheelProps = {
  hours: number;
  minutes: number;
  onChange: (hours: number, minutes: number) => void;
};

export function TimeWheel({ hours, minutes, onChange }: TimeWheelProps) {
  return (
    <div className="relative rounded-card border border-stroke bg-surface2">
      {/* Полоса выбора по центру. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-3 top-1/2 -translate-y-1/2 rounded-pill
                   border border-stroke bg-surface"
        style={{ height: ITEM_HEIGHT }}
      />
      <div className="relative flex">
        <Column values={HOURS} value={hours} onChange={(h) => onChange(h, minutes)} label="Часы" />
        <span className="flex items-center font-mono text-title text-mist">:</span>
        <Column
          values={MINUTES}
          value={minutes}
          onChange={(m) => onChange(hours, m)}
          label="Минуты"
        />
      </div>
    </div>
  );
}
