import { AnimatePresence, motion, useAnimationControls, type PanInfo } from 'framer-motion';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { spring } from '@/lib/motion/presets';
import {
  WEEKDAYS,
  addMonths,
  formatMonth,
  isInMonth,
  isPastDay,
  isSameDay,
  isToday,
  monthGrid,
  startOfMonth,
} from '@/lib/time';
import { PERSON_VAR, type PersonColor } from '@/types/person';

/** Ключ дня для меток: `2026-09-15`. */
export function dayKey(day: Date): string {
  const m = `${day.getMonth() + 1}`.padStart(2, '0');
  const d = `${day.getDate()}`.padStart(2, '0');
  return `${day.getFullYear()}-${m}-${d}`;
}

type CalendarProps = {
  selected: Date | null;
  onSelect: (day: Date) => void;
  /** Дни с уже запланированными свиданиями: ключ дня → цвет автора. */
  markers?: ReadonlyMap<string, PersonColor>;
};

// Порог свайпа: либо утащили достаточно далеко, либо дёрнули быстро (ТЗ 7.1).
const SWIPE_DISTANCE = 60;
const SWIPE_VELOCITY = 300;

function MonthGrid({
  month,
  selected,
  markers,
  onSelect,
  width,
}: {
  month: Date;
  selected: Date | null;
  markers: ReadonlyMap<string, PersonColor> | undefined;
  onSelect: (day: Date) => void;
  /** Ширина экрана в px.
   *
   * Именно число, а не `w-full`: лента шириной в три экрана, и процент
   * отсчитывался бы от неё — месяц выходил втрое шире видимой области,
   * и большая часть дней уезжала за край.
   */
  width: number;
}) {
  return (
    <div
      className="grid shrink-0 grid-cols-7 gap-y-1"
      style={{ width: width || '33.3333%' }}
    >
      {monthGrid(month).map((day) => {
        const outside = !isInMonth(day, month);
        const past = isPastDay(day);
        const chosen = selected !== null && isSameDay(day, selected);
        const marker = markers?.get(dayKey(day));

        return (
          <button
            key={day.toISOString()}
            type="button"
            disabled={past || outside}
            onClick={() => {
              onSelect(day);
              // Тактильный отклик на выбор даты (ТЗ 15.4).
              navigator.vibrate?.(10);
            }}
            aria-label={day.toLocaleDateString('ru-RU', { dateStyle: 'long' })}
            aria-current={isToday(day) ? 'date' : undefined}
            className="relative flex h-[46px] min-h-tap items-center justify-center"
          >
            {chosen && (
              <motion.span
                layoutId="calendar-selection"
                transition={spring.snappy}
                className="absolute inset-x-1 inset-y-0 rounded-cell"
                style={{ background: 'var(--person-color)' }}
              />
            )}

            <span
              className={[
                'relative text-body font-medium tabular-nums',
                outside ? 'opacity-0' : '',
                past ? 'text-ghost' : chosen ? 'text-coal' : 'text-chalk',
              ].join(' ')}
            >
              {day.getDate()}
            </span>

            {isToday(day) && !chosen && (
              <span className="absolute bottom-0 h-[3px] w-[3px] rounded-full bg-chalk" />
            )}

            {marker && !chosen && (
              <span
                className="absolute bottom-0 h-[5px] w-[5px] rounded-full"
                style={{ background: PERSON_VAR[marker] }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Календарь на месяц со свайпом (ТЗ 7.1).
 *
 * Написан с нуля: готовые библиотеки потребовали бы переопределения всех
 * стилей и всё равно не дали бы свайп-переходы между месяцами.
 *
 * В DOM всегда три месяца — предыдущий, текущий и следующий, — чтобы
 * соседний был уже отрисован к моменту, когда палец потянет ленту.
 */
export function Calendar({ selected, onSelect, markers }: CalendarProps) {
  const [month, setMonth] = useState(() => startOfMonth(selected ?? new Date()));
  const [direction, setDirection] = useState(0);
  const [width, setWidth] = useState(0);
  const viewport = useRef<HTMLDivElement>(null);
  const controls = useAnimationControls();

  // Ширина нужна в пикселях: свайп оперирует ими, а не процентами.
  useLayoutEffect(() => {
    const el = viewport.current;
    if (!el) return;

    const measure = () => setWidth(el.clientWidth);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Лента стоит на среднем месяце.
  useEffect(() => {
    if (width > 0) void controls.set({ x: -width });
  }, [controls, width, month]);

  const shift = (step: -1 | 1) => {
    setDirection(step);
    void controls
      .start({ x: -width - step * width, transition: spring.soft })
      .then(() => setMonth((current) => addMonths(current, step)));
  };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const far = Math.abs(info.offset.x) > SWIPE_DISTANCE;
    const fast = Math.abs(info.velocity.x) > SWIPE_VELOCITY;

    if (far || fast) {
      shift(info.offset.x < 0 ? 1 : -1);
      return;
    }
    void controls.start({ x: -width, transition: spring.soft });
  };

  return (
    <div>
      <div className="mb-4 flex h-8 items-center justify-between">
        {/* Заголовок месяца уезжает вертикально в сторону листания (ТЗ 7.1). */}
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.h2
            key={formatMonth(month)}
            custom={direction}
            initial={{ opacity: 0, y: direction >= 0 ? 14 : -14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: direction >= 0 ? -14 : 14 }}
            transition={spring.snappy}
            className="font-display text-title uppercase first-letter:uppercase"
          >
            {formatMonth(month)}
          </motion.h2>
        </AnimatePresence>

        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label="Предыдущий месяц"
            className="flex min-h-tap min-w-tap items-center justify-center text-mist"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label="Следующий месяц"
            className="flex min-h-tap min-w-tap items-center justify-center text-mist"
          >
            ›
          </button>
        </div>
      </div>

      <div className="mb-2 grid grid-cols-7">
        {WEEKDAYS.map((weekday) => (
          <span key={weekday} className="text-center font-mono text-label uppercase text-ghost">
            {weekday}
          </span>
        ))}
      </div>

      <div ref={viewport} className="overflow-hidden">
        <motion.div
          className="flex"
          style={{ width: width * 3 || '300%' }}
          drag="x"
          dragConstraints={{ left: -width * 2, right: 0 }}
          dragElastic={0.15}
          onDragEnd={handleDragEnd}
          animate={controls}
        >
          <MonthGrid
            month={addMonths(month, -1)}
            selected={selected}
            markers={markers}
            onSelect={onSelect}
            width={width}
          />
          <MonthGrid
            month={month}
            selected={selected}
            markers={markers}
            onSelect={onSelect}
            width={width}
          />
          <MonthGrid
            month={addMonths(month, 1)}
            selected={selected}
            markers={markers}
            onSelect={onSelect}
            width={width}
          />
        </motion.div>
      </div>
    </div>
  );
}
