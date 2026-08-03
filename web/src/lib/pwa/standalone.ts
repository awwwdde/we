/** Определение режима отображения и платформы (ТЗ 2.1, 13.2). */

export type Platform = 'ios' | 'android' | 'other';

/**
 * Приложение запущено с домашнего экрана, а не во вкладке браузера.
 *
 * Проверяются оба признака: `display-mode` — стандартный, но Safari до
 * недавнего времени сообщал об этом только через нестандартное
 * `navigator.standalone`.
 */
export function isStandalone(): boolean {
  if (window.matchMedia('(display-mode: standalone)').matches) return true;

  // `navigator.standalone` есть только в Safari и в типах DOM отсутствует.
  const legacy = (navigator as Navigator & { standalone?: boolean }).standalone;
  return legacy === true;
}

export function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

/**
 * Safari на iOS — единственный браузер, откуда там можно поставить PWA.
 * Chrome и Firefox на iOS используют тот же движок, но пункта «На экран
 * "Домой"» в их меню нет, и об этом нужно сказать прямо.
 */
export function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  if (!/iPhone|iPad|iPod/.test(ua)) return false;
  return !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}
