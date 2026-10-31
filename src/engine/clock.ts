/**
 * Day arithmetic. Spacing works in whole calendar days, so everything is
 * keyed by a local "day number" instead of timestamps. A demo offset lets
 * people trying the app skip ahead without waiting.
 */

const MS_PER_DAY = 86_400_000;

/** Days since 1970-01-01 in the user's local time zone. */
export function dayNumber(date: Date): number {
  return Math.floor((date.getTime() - date.getTimezoneOffset() * 60_000) / MS_PER_DAY);
}

export function today(offsetDays: number, now: Date = new Date()): number {
  return dayNumber(now) + offsetDays;
}

/** Local midnight of a day number, as a Date. */
export function dayToDate(day: number): Date {
  const utc = new Date(day * MS_PER_DAY);
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
}

/** Parse a <input type="date"> value ("2026-11-09") into a day number. */
export function isoToDay(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return dayNumber(new Date(y, m - 1, d));
}

export function dayToIso(day: number): string {
  const d = dayToDate(day);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatDay(day: number): string {
  return dayToDate(day).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** "today", "tomorrow", "in 3 days", "2 days ago". */
export function relativeDay(day: number, from: number): string {
  const diff = day - from;
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  return diff > 0 ? `in ${diff} days` : `${-diff} days ago`;
}
