/** Цвет человека. Не украшение: по нему читается авторство свидания (ТЗ 5.1). */
export type PersonColor = 'ember' | 'iris';

export const PERSON_HEX: Record<PersonColor, string> = {
  ember: '#FF4D4D',
  iris: '#7B5CFF',
};

/**
 * CSS-переменная, которой подсвечиваются элементы текущего пользователя.
 * Значение выставляется на корне приложения после входа (Фаза 2).
 */
export const PERSON_COLOR_VAR = '--person-color';
