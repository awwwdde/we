import { useEffect, useRef } from 'react';

import { PERSON_HEX } from '@/types/person';

/**
 * Состояния сфер (ТЗ 5.4).
 *
 * apart   — свиданий нет: сферы медленно дрейфуют по своим орбитам;
 * pulling — приглашение отправлено, ответа нет: сближаются и пульсируют;
 * merged  — подтверждено: съезжаются в центр и смешиваются в одну.
 */
export type OrbState = 'apart' | 'pulling' | 'merged';

type OrbFieldProps = {
  state?: OrbState;
  className?: string;
};

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Фирменный фон из двух сфер.
 *
 * Технически это два div с radial-gradient под blur — не картинка и не canvas:
 * так дешевле и масштабируется без потерь (ТЗ 5.4).
 *
 * Анимацией владеет GSAP и только он: Framer Motion эти узлы не трогает
 * (ТЗ 8.1 — один DOM-узел анимируется одной библиотекой). GSAP подгружается
 * динамическим импортом, чтобы не утяжелять стартовый бандл (ТЗ 15.5).
 */
export function OrbField({ state = 'apart', className }: OrbFieldProps) {
  const emberRef = useRef<HTMLDivElement>(null);
  const irisRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ember = emberRef.current;
    const iris = irisRef.current;
    if (!ember || !iris) return;

    // Уважаем prefers-reduced-motion: сферы просто замирают на своих местах
    // и остаются частью композиции (ТЗ 8.4).
    if (prefersReducedMotion()) return;

    let disposed = false;
    let cleanup: (() => void) | undefined;

    void import('gsap').then(({ gsap }) => {
      if (disposed) return;

      const ctx = gsap.context(() => {
        // will-change ставится на время анимации и снимается после (ТЗ 8.4).
        gsap.set([ember, iris], { willChange: 'transform' });

        if (state === 'merged') {
          gsap.to(ember, { xPercent: 12, yPercent: 6, scale: 1.1, duration: 1.2, ease: 'power3.inOut' });
          gsap.to(iris, { xPercent: -12, yPercent: -6, scale: 1.1, duration: 1.2, ease: 'power3.inOut' });
          return;
        }

        if (state === 'pulling') {
          // Сближаются и пульсируют в противофазе.
          gsap.to(ember, { xPercent: 18, yPercent: 10, duration: 1.2, ease: 'power3.inOut' });
          gsap.to(iris, { xPercent: -18, yPercent: -10, duration: 1.2, ease: 'power3.inOut' });
          gsap.to(ember, {
            scale: 1.12, opacity: 0.75, duration: 2.4,
            repeat: -1, yoyo: true, ease: 'sine.inOut', delay: 1.2,
          });
          gsap.to(iris, {
            scale: 0.9, opacity: 0.5, duration: 2.4,
            repeat: -1, yoyo: true, ease: 'sine.inOut', delay: 1.2 + 1.2,
          });
          return;
        }

        // apart: медленный дрейф по собственным орбитам, они не пересекаются.
        gsap.to(ember, {
          xPercent: 14, yPercent: -10, scale: 1.08,
          duration: 19, repeat: -1, yoyo: true, ease: 'sine.inOut',
        });
        gsap.to(iris, {
          xPercent: -12, yPercent: 12, scale: 0.94,
          duration: 23, repeat: -1, yoyo: true, ease: 'sine.inOut', delay: 1.5,
        });
      });

      cleanup = () => {
        ctx.revert();
        gsap.set([ember, iris], { willChange: 'auto' });
      };
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [state]);

  return (
    <div
      aria-hidden
      className={['pointer-events-none absolute inset-0 overflow-hidden', className].join(' ')}
    >
      <div
        ref={emberRef}
        className="absolute left-[-25%] top-[-15%] h-[85vw] w-[85vw] rounded-full"
        style={{
          background: `radial-gradient(circle at 38% 38%, ${PERSON_HEX.ember}, transparent 68%)`,
          filter: 'blur(70px)',
          opacity: 0.62,
        }}
      />
      <div
        ref={irisRef}
        className="absolute right-[-30%] top-[18%] h-[95vw] w-[95vw] rounded-full"
        style={{
          background: `radial-gradient(circle at 60% 45%, ${PERSON_HEX.iris}, transparent 66%)`,
          filter: 'blur(80px)',
          opacity: 0.55,
        }}
      />
      {/* Тёплая дымка поверх: смягчает контраст и уводит фон от «чистого
          чёрного» в сторону тёплого градиента. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 80% at 50% 0%, rgba(255,138,110,0.14), transparent 60%),' +
            'linear-gradient(180deg, transparent 35%, #0B0A0F 92%)',
        }}
      />
    </div>
  );
}
