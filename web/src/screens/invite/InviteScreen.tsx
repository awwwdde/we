import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { OrbField } from '@/components/orb/OrbField';
import { Button } from '@/components/ui/Button';
import { fetchInvite, respondToInvite, type InvitePublic } from '@/lib/api/invites';
import { screenVariants, spring } from '@/lib/motion/presets';
import { formatDayShort, formatTime, formatWeekday, splitDate, utcToZoned } from '@/lib/time';
import { MAX_ATTEMPTS, RunawayNo } from '@/screens/invite/RunawayNo';
import { PERSON_VAR } from '@/types/person';

/**
 * Публичный экран приглашения (макет, раздел 06).
 *
 * Четыре кадра одного сюжета. Экран не знает, кто его открыл, и потому
 * здесь нет ни таббара, ни навигации — только конверт и три вопроса.
 * Цвет на нём один: цвет того, кто задумал. `lime` появляется в последнем
 * кадре и означает ровно одно.
 */

type Frame = 'envelope' | 'q1' | 'q2' | 'q3' | 'done';

const SWIPE_UP = 60;

function Countdown({ target }: { target: Date }) {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return <>сейчас</>;
  const minutes = Math.floor(diff / 60_000);
  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);
  return <>{days > 0 ? `${days} д ${hours} ч` : `${hours} ч ${minutes % 60} мин`}</>;
}

export function InviteScreen() {
  const { token = '' } = useParams<{ token: string }>();
  const [frame, setFrame] = useState<Frame>('envelope');
  const [evadeCount, setEvadeCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const invite = useQuery({
    queryKey: ['invite', token],
    queryFn: () => fetchInvite(token),
    enabled: !!token,
    retry: false,
  });

  const data: InvitePublic | undefined = invite.data;
  const when = data ? utcToZoned(data.scheduled_at) : null;

  const accept = async () => {
    setSending(true);
    setError(null);
    try {
      await respondToInvite(token, true, evadeCount);
      // Подтверждение — единственное место с длинной вибрацией (ТЗ 7.6).
      navigator.vibrate?.([10, 40, 10]);
      setFrame('done');
    } catch {
      setError('Не получилось ответить. Попробуйте ещё раз.');
    } finally {
      setSending(false);
    }
  };

  if (invite.isPending) {
    return <div className="min-h-[100dvh] bg-coal" aria-busy="true" />;
  }

  if (invite.isError || !data || !when) {
    return (
      <div className="relative min-h-[100dvh] bg-coal">
        <OrbField state="apart" className="fixed" />
        <main className="screen relative flex min-h-[100dvh] flex-col justify-end">
          <h1 className="font-display text-display-l uppercase">Ссылка не открылась</h1>
          <p className="mt-3 text-body text-linen">
            Приглашение могло истечь или его уже отозвали. Спросите у того,
            кто прислал.
          </p>
        </main>
      </div>
    );
  }

  const authorColor = PERSON_VAR[data.author_color];
  const { day, month } = splitDate(when);
  const answered = data.answered && frame === 'envelope';

  // Сферы ведут сюжет: тянутся, пока идёт опросник, сливаются в финале.
  const orbState = frame === 'done' || (answered && data.accepted) ? 'merged' : 'drawing';

  const openEnvelope = () => {
    navigator.vibrate?.(10);
    setFrame(answered ? 'done' : 'q1');
  };

  const handleDrag = (_: unknown, info: PanInfo) => {
    if (info.offset.y < -SWIPE_UP) openEnvelope();
  };

  return (
    <div className="relative min-h-[100dvh] bg-coal">
      <OrbField state={orbState} className="fixed">
        {(frame === 'done' || (answered && data.accepted)) && (
          <p className="font-mono text-label uppercase text-lime">подтверждено</p>
        )}
      </OrbField>

      <main className="screen relative flex min-h-[100dvh] flex-col justify-end">
        {/*
          Ровно ОДИН ребёнок с меняющимся `key`. Раньше здесь стояло пять
          условных слотов — `AnimatePresence` в режиме `wait` получал массив,
          где четыре элемента `false`, и переход между кадрами застревал:
          exit не завершался, следующий кадр не монтировался, и до кнопки
          «Иду!» было не добраться.
        */}
        {/*
          `popLayout`, а не `wait`. В режиме `wait` следующий кадр монтируется
          только после того, как доиграет exit предыдущего, — и если анимация
          по любой причине не завершилась (свёрнутая вкладка, throttling rAF),
          человек застревает и до кнопки «Иду!» не добирается. Украшение
          не должно преграждать функциональный путь.
        */}
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={frame}
            variants={screenVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={spring.soft}
            className="flex flex-col gap-5"
          >
          {/* ── Кадр 1: конверт закрыт ─────────────────────────────── */}
          {frame === 'envelope' && (
            <motion.div
              // Открывается и тапом, и жестом: у неё может быть занята рука.
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.3}
              onDragEnd={handleDrag}
              className="flex flex-col gap-6"
            >
              <p className="font-mono text-label uppercase text-mist">
                Тебе · от {data.author_name}
              </p>

              {/* Печать — инициал в цвете автора. */}
              <span
                className="flex h-16 w-16 items-center justify-center rounded-full font-display text-title uppercase text-coal"
                style={{ background: authorColor }}
                aria-hidden
              >
                {data.author_name.charAt(0)}
              </span>

              <h1 className="font-display text-display-xl uppercase leading-[0.95]">
                {answered ? (data.accepted ? 'Уже сказано «да»' : 'Уже отвечено') : (
                  <>
                    Что-то
                    <br />
                    задумано
                  </>
                )}
              </h1>

              <p className="max-w-[30ch] text-body text-linen">
                {answered
                  ? 'Это приглашение уже открывали и на него ответили.'
                  : 'Внутри дата, время и место. И, кажется, термос.'}
              </p>

              <div>
                <Button onClick={openEnvelope}>{answered ? 'Посмотреть' : 'Открыть'}</Button>
                {!answered && (
                  <p className="mt-3 text-center font-mono text-label uppercase text-ghost">
                    или потяни конверт вверх
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {/* ── Кадр 2: вопрос 1 ───────────────────────────────────── */}
          {frame === 'q1' && (
            <div className="flex flex-col gap-5">
              <p className="font-mono text-label uppercase text-mist">
                {data.author_name} зовёт тебя
              </p>

              {/* Самый крупный текст во всём приложении. */}
              <p className="font-display text-[56px] uppercase leading-[0.9] tracking-[-0.03em]">
                {day}
                <br />
                {month}
              </p>

              <p className="font-mono text-title tabular-nums text-chalk">
                {data.is_all_day ? 'весь день' : formatTime(when)}
              </p>

              <p className="text-title">{data.place.name}</p>
              {data.note && <p className="text-body text-linen">{data.note}</p>}

              <p className="mt-2 font-display text-display-l uppercase">Идём?</p>

              <div className="flex flex-col gap-3">
                <Button onClick={() => setFrame('q2')}>Да</Button>
                {/* Здесь «Нет» пока выглядит нормально: подвох должен быть
                    неожиданным. */}
                <Button variant="ghost" onClick={() => setFrame('q2')}>
                  Нет
                </Button>
              </div>
            </div>
          )}

          {/* ── Кадр 3: вопрос 2, «Нет» убегает ────────────────────── */}
          {frame === 'q2' && (
            <div className="flex flex-col gap-5">
              <h1 className="font-display text-display-xl uppercase leading-[0.95]">
                Точно-
                <br />
                точно?
              </h1>

              <p className="max-w-[32ch] text-body text-linen">
                {data.author_name} уже погуглил(а), где там ближе всего
                мороженое. Обратной дороги, в общем, нет.
              </p>

              <div className="flex flex-col gap-3">
                <Button onClick={() => setFrame('q3')}>Конечно</Button>
                <RunawayNo
                  label="Нет"
                  evadeCount={evadeCount}
                  onEvade={() => setEvadeCount((n) => n + 1)}
                />
                {/* Подпись появляется после третьего уклонения. */}
                {evadeCount >= 3 && evadeCount < MAX_ATTEMPTS && (
                  <p className="text-center font-mono text-label uppercase text-ghost">
                    (эта кнопка сломалась)
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── Кадр 4: вопрос 3, остаётся одно действие ───────────── */}
          {frame === 'q3' && (
            <div className="flex flex-col gap-5">
              <h1 className="font-display text-display-xl uppercase leading-[0.95]">
                Последний
                <br />
                шанс
              </h1>

              <p className="max-w-[32ch] text-body text-linen">
                Передумать больше нечем: кнопка «Нет» окончательно сломалась.
              </p>

              <p className="font-mono text-label uppercase text-mist">
                {formatDayShort(when)} · {formatWeekday(when).slice(0, 2)} ·{' '}
                {data.is_all_day ? 'весь день' : formatTime(when)}
              </p>
              <p className="text-body text-chalk">{data.place.name}</p>

              <p className="text-center font-mono text-label uppercase text-ghost">
                кнопка «нет» ушла насовсем
              </p>

              {/* Единственная кнопка в приложении с display-шрифтом. */}
              <button
                type="button"
                onClick={() => void accept()}
                disabled={sending}
                className="flex h-[68px] w-full items-center justify-center rounded-pill
                           font-display text-title uppercase text-coal disabled:opacity-60"
                style={{ background: authorColor }}
              >
                {sending ? 'Секунду…' : 'Иду!'}
              </button>

              <p className="text-center font-mono text-label uppercase text-mist">
                {data.author_name} узнает сразу же
              </p>

              {error && (
                <p role="alert" className="text-center text-caption" style={{ color: authorColor }}>
                  {error}
                </p>
              )}
            </div>
          )}

          {/* ── Кадр 5: договорились ───────────────────────────────── */}
          {frame === 'done' && (
            <div className="flex flex-col gap-5">
              <h1 className="font-display text-display-xl uppercase leading-[0.95]">
                Договори-
                <br />
                лись
              </h1>

              <p className="max-w-[32ch] text-body text-linen">
                {data.author_name} узнал(а) об этом раньше, чем ты убрала палец
                с экрана.
              </p>

              <p className="font-mono text-label uppercase text-mist">
                {formatDayShort(when)} ·{' '}
                {data.is_all_day ? 'весь день' : formatTime(when)} ·{' '}
                <Countdown target={when} />
              </p>

              <Link
                to="/"
                className="mt-2 inline-flex min-h-tap items-center justify-center rounded-pill
                           border border-stroke px-6 text-body text-chalk"
              >
                Открыть в приложении
              </Link>
            </div>
          )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
