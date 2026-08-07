import Lenis from 'lenis';
import { useEffect } from 'react';

/**
 * Инерция скролла (ТЗ 8.3).
 *
 * Lenis ничего не анимирует сам — он только сглаживает скролл. Инициализация
 * ровно одна, в корневом layout: второй экземпляр даёт два обработчика на
 * одно колесо и скролл начинает ускоряться.
 *
 * `syncTouch: false` обязателен. На iOS собственная инерция Safari работает
 * лучше эмуляции, и перехват даёт заметное «залипание» пальца.
 *
 * Связки с `gsap.ticker` из ТЗ 8.3 здесь нет намеренно: она нужна ради
 * ScrollTrigger, а его в проекте не появилось — сферы живут на своём
 * таймлайне и от скролла не зависят. Лишний тикер стоил бы кадров на
 * каждом экране, ничего не давая взамен.
 *
 * При `prefers-reduced-motion` Lenis не поднимается вовсе: сглаживание
 * скролла — ровно то движение, от которого человек и отказался.
 */
export function useLenis(): void {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      syncTouch: false,
    });

    let frame = 0;
    const raf = (time: number): void => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, []);
}
