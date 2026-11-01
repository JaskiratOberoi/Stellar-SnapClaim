/**
 * Formatting helpers shared by screens and the assistant's replies.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function endOfDay(timestamp: number): number {
  return startOfDay(timestamp) + DAY_MS - 1;
}

export function startOfMonth(timestamp: number): number {
  const date = new Date(timestamp);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function endOfMonth(timestamp: number): number {
  const date = new Date(timestamp);
  date.setMonth(date.getMonth() + 1, 1);
  date.setHours(0, 0, 0, 0);
  return date.getTime() - 1;
}

export function startOfWeek(timestamp: number): number {
  const date = new Date(startOfDay(timestamp));
  const day = (date.getDay() + 6) % 7; // Monday = 0
  return date.getTime() - day * DAY_MS;
}

export function addDays(timestamp: number, days: number): number {
  return timestamp + days * DAY_MS;
}

export function isSameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b);
}

export function formatMoney(amount: number, currency: string, locale?: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function formatTime(timestamp: number, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(
    new Date(timestamp),
  );
}

export function formatShortDate(timestamp: number, locale?: string): string {
  const now = Date.now();
  const sameYear = new Date(timestamp).getFullYear() === new Date(now).getFullYear();
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(sameYear ? null : { year: 'numeric' }),
  }).format(new Date(timestamp));
}

export function formatMonth(timestamp: number, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
    new Date(timestamp),
  );
}

/**
 * "Today 5:00 pm", "Tomorrow", "Yesterday", "Mon 3 Nov 9:30 am".
 * `withTime` is false when the timestamp is a plain date (midnight).
 */
export function formatWhen(timestamp: number, locale?: string): string {
  const now = Date.now();
  const hasTime = timestamp !== startOfDay(timestamp);
  const time = hasTime ? ` ${formatTime(timestamp, locale)}` : '';
  if (isSameDay(timestamp, now)) return `Today${time}`;
  if (isSameDay(timestamp, addDays(now, 1))) return `Tomorrow${time}`;
  if (isSameDay(timestamp, addDays(now, -1))) return `Yesterday${time}`;
  return `${formatShortDate(timestamp, locale)}${time}`;
}

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
