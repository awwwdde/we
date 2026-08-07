import { useEffect, useRef } from 'react';

/**
 * Состояния сфер (редизайн, раздел 02).
 *
 * Раньше сферы дрейфовали каждая сама по себе, и «сближение» приходилось
 * угадывать. Теперь у них есть **общая орбита** — кольцо в 1px, на котором
 * обе сидят. Смысл читается геометрически: чем ближе точки на кольце, тем
 * ближе свидание.
 *
 * apart   — свиданий нет: на противоположных концах кольца, дрейф ±8px;
 * drawing — приглашение отправлено: съезжаются до пересечения на 30%,
 *           между ними светлый мост, пульсация в противофазе;
 * merged  — подтверждено: одна сфера в центре, кольцо подсвечено lime.
 */
export type OrbState = 'apart' | 'drawing' | 'merged';

type OrbFieldProps = {
  state?: OrbState;
  className?: string;
  /** Что показать внутри слитой сферы — обратный отсчёт. */
  children?: React.ReactNode;
};

// Спецификация из макета.
const ORBIT_RATIO = 0.52; // доля ширины экрана
const ORB_RATIO = 0.72; // доля диаметра орбиты
const DRIFT = 8; // px вдоль орбиты
const TRANSITION = 1.2; // с, power3.inOut

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** В офлайне сферы замирают — это часть офлайн-состояния (ТЗ 14.3). */
function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * Фирменный фон: две сферы на одной орбите.
 *
 * Техника не изменилась — `div` + `radial-gradient` + `blur`, ни картинок,
 * ни canvas. Анимируются только `transform` и `opacity` (ТЗ 8.4).
 * Владеет анимацией только GSAP: Framer Motion эти узлы не трогает (ТЗ 8.1).
 */
export function OrbField({ state = 'apart', className, children }: OrbFieldProps) {
  const emberRef = useRef<HTMLDivElement>(null);
  const irisRef = useRef<HTMLDivElement>(null);
  const bridgeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ember = emberRef.current;
    const iris = irisRef.current;
    const bridge = bridgeRef.current;
    if (!ember || !iris || !bridge) return;

    // Сдвиг сфер вдоль орбиты: 0 — на противоположных концах,
    // 1 — обе в центре кольца.
    const closeness = state === 'merged' ? 1 : state === 'drawing' ? 0.7 : 0;

    let disposed = false;
    let cleanup: (() => void) | undefined;

    void import('gsap').then(({ gsap }) => {
      if (disposed) return;

      // Уважаем «уменьшить движение»: конечная поза без дрейфа (ТЗ 8.4).
      const still = prefersReducedMotion() || isOffline();
      const ease = 'power3.inOut';
      const duration = still ? 0 : TRANSITION;

      const ctx = gsap.context(() => {
        gsap.set([ember, iris], { willChange: 'transform' });

        // Позиция вдоль орбиты в процентах от собственного размера.
        const offset = 50 * (1 - closeness);
        gsap.to(ember, { xPercent: -offset, duration, ease });
        gsap.to(iris, { xPercent: offset, duration, ease });
        gsap.to(bridge, {
          opacity: state === 'drawing' ? 1 : 0,
          duration,
          ease,
        });

        if (still) return;

        if (state === 'apart') {
          // Дрейф ±8px, yoyo 19с и 23с, противофаза.
          gsap.to(ember, {
            x: DRIFT,
            duration: 19,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
            delay: TRANSITION,
          });
          gsap.to(iris, {
            x: -DRIFT,
            duration: 23,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
            delay: TRANSITION,
          });
        }

        if (state === 'drawing') {
          // Пульсация .96↔1.04 в противофазе, 2.4с.
          gsap.to(ember, {
            scale: 1.04,
            duration: 2.4,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
            delay: TRANSITION,
          });
          gsap.to(iris, {
            scale: 0.96,
            duration: 2.4,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
            delay: TRANSITION,
          });
        }
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

  const orbSize = `calc(${ORBIT_RATIO * ORB_RATIO * 100}vw)`;
  // Blur — 0.22 диаметра сферы (≈34px на экране 390).
  const blur = `calc(${orbSize} * var(--orb-blur-scale))`;

  return (
    <div
      className={['pointer-events-none absolute inset-0 overflow-hidden', className]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Орбита — кольцо в 1px, на котором сидят обе сферы. */}
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: `${ORBIT_RATIO * 100}vw`,
          height: `${ORBIT_RATIO * 100}vw`,
          border: '1px solid var(--orbit-ring)',
          // Кольцо подсвечивается lime только когда свидание подтверждено —
          // единственная роль этого цвета здесь.
          boxShadow:
            state === 'merged'
              ? '0 0 0 1px color-mix(in srgb, var(--lime) 22%, transparent)'
              : undefined,
          transition: 'box-shadow 1.2s cubic-bezier(0.65, 0, 0.35, 1)',
        }}
      />

      {/* Мост между сферами — виден только в состоянии «тянутся». */}
      <div
        ref={bridgeRef}
        aria-hidden
        className="absolute left-1/2 top-1/2 h-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: `${ORBIT_RATIO * 40}vw`,
          background:
            'linear-gradient(90deg, var(--ember), var(--chalk), var(--iris))',
          opacity: 0,
          filter: 'blur(2px)',
        }}
      />

      <div
        ref={emberRef}
        aria-hidden
        className="absolute left-1/2 top-1/2 rounded-full"
        style={{
          width: orbSize,
          height: orbSize,
          marginLeft: `calc(${orbSize} / -2)`,
          marginTop: `calc(${orbSize} / -2)`,
          background: 'radial-gradient(circle at 38% 38%, var(--ember), transparent 68%)',
          filter: `blur(${blur})`,
          opacity: 'var(--orb-opacity)',
        }}
      />
      <div
        ref={irisRef}
        aria-hidden
        className="absolute left-1/2 top-1/2 rounded-full"
        style={{
          width: orbSize,
          height: orbSize,
          marginLeft: `calc(${orbSize} / -2)`,
          marginTop: `calc(${orbSize} / -2)`,
          background: 'radial-gradient(circle at 60% 45%, var(--iris), transparent 66%)',
          filter: `blur(${blur})`,
          opacity: 'var(--orb-opacity)',
        }}
      />

      {/* Отсчёт внутри слитой сферы. */}
      {children && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          {children}
        </div>
      )}
    </div>
  );
}
