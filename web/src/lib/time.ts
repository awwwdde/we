import {
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  isSameDay,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

/**
 * Работа со временем.
 *
 * Всё хранится в UTC, показывается всегда в Москве — независимо от того,
 * где физически находится телефон. Иначе в поездке приложение начнёт
 * считать «сегодня» и прошедшие дни неправильно (ТЗ 7.1, 10).
 */
export const TIMEZONE = 'Europe/Moscow';

/** Текущий момент, приведённый к московскому времени. */
export function nowInZone(): Date {
  return toZonedTime(new Date(), TIMEZONE);
}

/** Московская «стенка» календаря → момент в UTC для отправки на сервер. */
export function zonedToUtc(zoned: Date): Date {
  return fromZonedTime(zoned, TIMEZONE);
}

/** UTC с сервера → московское время для показа. */
export function utcToZoned(iso: string | Date): Date {
  return toZonedTime(typeof iso === 'string' ? new Date(iso) : iso, TIMEZONE);
}

/** Собрать дату и время в один московский момент. */
export function combine(day: Date, hours: number, minutes: number): Date {
  const result = new Date(day);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

export function isPastDay(day: Date): boolean {
  return differenceInCalendarDays(startOfDay(day), startOfDay(nowInZone())) < 0;
}

export function isToday(day: Date): boolean {
  return isSameDay(day, nowInZone());
}

/**
 * Сетка месяца 7×6, недели с понедельника (ТЗ 7.1).
 *
 * Ровно 42 ячейки всегда: если число строк плавает, сетка дёргается при
 * переключении месяцев.
 */
export function monthGrid(month: Date): Date[] {
  const first = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  return Array.from({ length: 42 }, (_, i) => {
    const day = new Date(first);
    day.setDate(first.getDate() + i);
    return day;
  });
}

export function isInMonth(day: Date, month: Date): boolean {
  return day.getMonth() === month.getMonth() && day.getFullYear() === month.getFullYear();
}

export const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'] as const;

export function formatMonth(month: Date): string {
  return format(month, 'LLLL yyyy', { locale: ru });
}

export function formatDayLong(day: Date): string {
  return format(day, 'd MMMM', { locale: ru });
}

export function formatWeekday(day: Date): string {
  return format(day, 'EEEE', { locale: ru });
}

/** «12 авг» — для ленты истории.
 *
 * Точку после сокращения убираем: в ленте она стоит рядом с разделителем
 * `·` и читается как мусор.
 */
export function formatDayShort(day: Date): string {
  return format(day, 'd MMM', { locale: ru }).replace('.', '');
}

/** «Август 2026» — заголовок группы в ленте. */
export function formatMonthYear(day: Date): string {
  return format(day, 'LLLL yyyy', { locale: ru });
}

/** «20» и «августа» отдельно: в макете дата стоит в две строки. */
export function splitDate(day: Date): { day: string; month: string } {
  return { day: format(day, 'd'), month: format(day, 'MMMM', { locale: ru }) };
}

export function formatTime(day: Date): string {
  return format(day, 'HH:mm');
}

export { addMonths, endOfMonth, isSameDay, startOfMonth };
