import { useMutation, useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { Calendar } from '@/components/calendar/Calendar';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { TimeWheel } from '@/components/ui/TimeWheel';
import { ApiError } from '@/lib/api/client';
import { createCustomPlace, createDate, fetchCustomPlaces } from '@/lib/api/dates';
import { screenVariants, spring } from '@/lib/motion/presets';
import { combine, formatDayLong, formatTime, zonedToUtc } from '@/lib/time';
import { useDateDraft } from '@/screens/create-date/useDateDraft';
import { PERSON_HEX } from '@/types/person';

/** Шаги мастера. Хранятся в query, чтобы «назад» в браузере работал (ТЗ 6.1). */
const STEPS = ['date', 'time', 'place', 'note', 'preview'] as const;
type Step = (typeof STEPS)[number];

const STEP_TITLE: Record<Step, string> = {
  date: 'Когда',
  time: 'Во сколько',
  place: 'Где',
  note: 'Записка',
  preview: 'Проверьте',
};

// Быстрые пресеты времени (ТЗ 7.2).
const PRESETS = [
  { label: 'Вечером', hours: 19, minutes: 0 },
  { label: 'После работы', hours: 18, minutes: 30 },
] as const;

const NOTE_LIMIT = 280;

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'min-h-tap rounded-pill border px-4 text-caption transition-colors',
        active ? 'border-transparent text-void' : 'border-stroke text-mist',
      ].join(' ')}
      style={active ? { background: 'var(--person-color)' } : undefined}
    >
      {children}
    </button>
  );
}

export function CreateDateScreen() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const draft = useDateDraft();
  const [error, setError] = useState<string | null>(null);
  const [newPlaceName, setNewPlaceName] = useState('');

  const raw = params.get('step');
  const step: Step = STEPS.includes(raw as Step) ? (raw as Step) : 'date';
  const index = STEPS.indexOf(step);

  const places = useQuery({ queryKey: ['custom-places'], queryFn: fetchCustomPlaces });

  const addPlace = useMutation({
    mutationFn: (name: string) => createCustomPlace({ name }),
    onSuccess: (place) => {
      draft.setPlace({ source: 'custom', name: place.name, external_id: place.id });
      setNewPlaceName('');
      void places.refetch();
    },
  });

  const submit = useMutation({
    mutationFn: () => {
      if (!draft.day || !draft.place) throw new Error('Черновик не заполнен');
      const moment = draft.isAllDay
        ? combine(draft.day, 0, 0)
        : combine(draft.day, draft.hours, draft.minutes);

      return createDate({
        // Сервер ждёт UTC; момент собран по московской «стенке» календаря.
        scheduled_at: zonedToUtc(moment).toISOString(),
        is_all_day: draft.isAllDay,
        note: draft.note.trim() || null,
        place: draft.place,
      });
    },
    onSuccess: (plan) => {
      navigator.vibrate?.(30);
      draft.reset();
      navigate(`/date/${plan.id}`, { replace: true });
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : 'Не получилось сохранить'),
  });

  const go = (to: Step) => setParams({ step: to }, { replace: false });

  const canContinue =
    (step === 'date' && draft.day !== null) ||
    step === 'time' ||
    (step === 'place' && draft.place !== null) ||
    step === 'note' ||
    step === 'preview';

  const next = () => {
    if (step === 'preview') {
      submit.mutate();
      return;
    }
    const following = STEPS[index + 1];
    if (following) go(following);
  };

  const back = () => {
    const previous = STEPS[index - 1];
    if (previous) go(previous);
    else navigate('/');
  };

  return (
    <Screen withTabBar={false}>
      <header className="mb-6 flex items-center justify-between">
        <button type="button" onClick={back} className="min-h-tap min-w-tap text-mist">
          ‹
        </button>
        <p className="font-mono text-label uppercase text-mist">
          Шаг {index + 1} из {STEPS.length}
        </p>
        <button
          type="button"
          onClick={() => {
            draft.reset();
            navigate('/');
          }}
          className="min-h-tap px-2 text-caption text-ghost"
        >
          Бросить
        </button>
      </header>

      <h1 className="mb-6 font-display text-display-l uppercase">{STEP_TITLE[step]}</h1>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          variants={screenVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={spring.soft}
        >
          {step === 'date' && (
            <Calendar selected={draft.day} onSelect={draft.setDay} />
          )}

          {step === 'time' && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((preset) => (
                  <Chip
                    key={preset.label}
                    active={
                      !draft.isAllDay &&
                      draft.hours === preset.hours &&
                      draft.minutes === preset.minutes
                    }
                    onClick={() => draft.setTime(preset.hours, preset.minutes)}
                  >
                    {preset.label}
                  </Chip>
                ))}
                <Chip active={draft.isAllDay} onClick={() => draft.setAllDay(!draft.isAllDay)}>
                  На весь день
                </Chip>
              </div>

              {!draft.isAllDay && (
                <TimeWheel
                  hours={draft.hours}
                  minutes={draft.minutes}
                  onChange={draft.setTime}
                />
              )}
            </div>
          )}

          {step === 'place' && (
            <div className="flex flex-col gap-4">
              <p className="text-caption text-mist">
                Пока только наши места. Поиск по городу появится в Фазе 5.
              </p>

              <ul className="flex flex-col gap-2">
                {places.data?.map((place) => (
                  <li key={place.id}>
                    <button
                      type="button"
                      onClick={() =>
                        draft.setPlace({
                          source: 'custom',
                          name: place.name,
                          external_id: place.id,
                          category: place.category,
                          address: place.address,
                        })
                      }
                      className={[
                        'w-full rounded-card border p-4 text-left transition-colors',
                        draft.place?.external_id === place.id
                          ? 'border-transparent bg-surface2'
                          : 'border-stroke bg-surface',
                      ].join(' ')}
                    >
                      <span className="text-body">{place.name}</span>
                      {place.category && (
                        <span className="ml-2 font-mono text-label uppercase text-ghost">
                          {place.category}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>

              <div className="flex gap-2">
                <input
                  value={newPlaceName}
                  onChange={(e) => setNewPlaceName(e.target.value)}
                  placeholder="Добавить своё место"
                  className="min-h-tap flex-1 rounded-pill border border-stroke bg-surface2 px-4
                             text-body text-chalk placeholder:text-ghost focus:outline-none"
                />
                <button
                  type="button"
                  disabled={!newPlaceName.trim() || addPlace.isPending}
                  onClick={() => addPlace.mutate(newPlaceName.trim())}
                  className="min-h-tap min-w-tap rounded-pill bg-surface2 px-5 text-body disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>
          )}

          {step === 'note' && (
            <div className="flex flex-col gap-2">
              <textarea
                value={draft.note}
                onChange={(e) => draft.setNote(e.target.value.slice(0, NOTE_LIMIT))}
                rows={5}
                placeholder="Необязательно"
                className="w-full rounded-card border border-stroke bg-surface2 p-4 text-body
                           text-chalk placeholder:text-ghost focus:outline-none"
              />
              <span className="self-end font-mono text-label uppercase text-ghost">
                {draft.note.length} / {NOTE_LIMIT}
              </span>
            </div>
          )}

          {step === 'preview' && draft.day && (
            <div className="rounded-card border border-stroke bg-surface p-5">
              <p className="font-mono text-label uppercase text-mist">
                {draft.isAllDay ? 'Весь день' : formatTime(combine(draft.day, draft.hours, draft.minutes))}
              </p>
              <p className="mt-2 font-display text-display-l uppercase first-letter:uppercase">
                {formatDayLong(draft.day)}
              </p>
              <p className="mt-3 text-body">{draft.place?.name}</p>
              {draft.note.trim() && (
                <p className="mt-3 text-caption text-mist">{draft.note}</p>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {error && (
        <p role="alert" className="mt-4 text-caption" style={{ color: PERSON_HEX.ember }}>
          {error}
        </p>
      )}

      <div className="mt-8">
        <Button onClick={next} disabled={!canContinue} loading={submit.isPending}>
          {step === 'preview' ? 'Сохранить' : 'Дальше'}
        </Button>
      </div>
    </Screen>
  );
}
