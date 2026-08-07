import type { DatePlan } from '@/lib/api/dates';
import { utcToZoned } from '@/lib/time';

/**
 * Экспорт свидания в календарь телефона (вопрос ТЗ 21.5).
 *
 * Собирается на клиенте, а не на сервере, по одной причине: ссылку-скачивание
 * нельзя снабдить заголовком `Authorization`, а access-токен живёт только
 * в памяти JS (ТЗ 9.6). Отдавать `.ics` по публичному адресу означало бы
 * выложить наружу место и время встречи. Все нужные поля и так уже в
 * карточке — ходить за ними второй раз незачем.
 *
 * Библиотека не нужна: формат RFC 5545 здесь — десяток строк текста.
 */

/** Длительность по умолчанию. В модели свидания конца нет, а `.ics` без
 *  `DTEND` показывается в календарях по-разному — от минуты до суток. */
const DEFAULT_HOURS = 2;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** `20260817T160000Z` — момент времени в UTC. */
function utcStamp(iso: string): string {
  const moment = new Date(iso);
  return (
    `${moment.getUTCFullYear()}${pad(moment.getUTCMonth() + 1)}${pad(moment.getUTCDate())}` +
    `T${pad(moment.getUTCHours())}${pad(moment.getUTCMinutes())}${pad(moment.getUTCSeconds())}Z`
  );
}

/** `20260817` — календарный день по Москве, для событий «весь день». */
function dayStamp(day: Date): string {
  return `${day.getFullYear()}${pad(day.getMonth() + 1)}${pad(day.getDate())}`;
}

/** Спецсимволы RFC 5545. Без экранирования запятая в адресе рвёт поле. */
function escape(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Свернуть строку до 75 октетов, как требует RFC 5545.
 *
 * Считаем именно октеты, а не символы: кириллица в UTF-8 занимает два
 * байта, и «75 символов» дали бы 150 октетов — часть календарей такую
 * строку просто отбрасывает. Режем по границе символа, иначе на месте
 * разрыва получится битый UTF-8.
 */
function fold(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;

  const parts: string[] = [];
  let current = '';
  let size = 0;
  // Первая строка вмещает 75 октетов, продолжения — 74: один октет
  // забирает ведущий пробел.
  let limit = 75;

  for (const char of line) {
    const width = encoder.encode(char).length;
    if (size + width > limit) {
      parts.push(current);
      current = '';
      size = 0;
      limit = 74;
    }
    current += char;
    size += width;
  }
  parts.push(current);

  return parts.join('\r\n ');
}

/** Текст файла `.ics` для одного свидания. */
export function buildIcs(plan: DatePlan): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Perigee//Свидания//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${plan.id}@perigee`,
    `DTSTAMP:${utcStamp(new Date().toISOString())}`,
  ];

  if (plan.is_all_day) {
    const start = utcToZoned(plan.scheduled_at);
    const end = new Date(start);
    // DTEND у события-дня не включается в интервал: чтобы день был один,
    // конец ставится на следующие сутки.
    end.setDate(end.getDate() + 1);
    lines.push(`DTSTART;VALUE=DATE:${dayStamp(start)}`, `DTEND;VALUE=DATE:${dayStamp(end)}`);
  } else {
    const end = new Date(new Date(plan.scheduled_at).getTime() + DEFAULT_HOURS * 3600_000);
    lines.push(`DTSTART:${utcStamp(plan.scheduled_at)}`, `DTEND:${utcStamp(end.toISOString())}`);
  }

  lines.push(`SUMMARY:${escape(plan.place.name)}`);

  const where = plan.place.address ?? plan.place.name;
  lines.push(`LOCATION:${escape(where)}`);

  if (plan.note) lines.push(`DESCRIPTION:${escape(plan.note)}`);
  if (plan.place.lat != null && plan.place.lon != null) {
    lines.push(`GEO:${plan.place.lat};${plan.place.lon}`);
  }

  lines.push('END:VEVENT', 'END:VCALENDAR');

  // Перевод строки в RFC 5545 — только CRLF.
  return lines.map(fold).join('\r\n') + '\r\n';
}

/**
 * Отдать файл телефону.
 *
 * Сначала системный share-sheet: на iOS это единственный путь, который
 * доводит `.ics` до приложения «Календарь» — обычная ссылка-скачивание
 * там открывает файл текстом. Если поделиться файлами нельзя, остаётся
 * скачивание: на Android и десктопе оно работает.
 */
export async function shareIcs(plan: DatePlan): Promise<void> {
  const text = buildIcs(plan);
  const file = new File([text], 'perigee.ics', { type: 'text/calendar' });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: plan.place.name });
      return;
    } catch {
      // Закрыли share-sheet — не ошибка, но и скачивать вслед не нужно.
      return;
    }
  }

  const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'perigee.ics';
  link.click();
  URL.revokeObjectURL(url);
}
