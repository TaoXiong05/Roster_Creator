// Shared date-grid helpers behind the Weekly/Fortnightly/Monthly calendar views used by
// both the roster create/edit page and the roster review page, so the two stay visually
// and behaviorally consistent instead of drifting apart.

export type ViewLength = 'weekly' | 'fortnightly' | 'monthly';

export const DAYS_PER_PAGE: Partial<Record<ViewLength, number>> = { weekly: 7, fortnightly: 14 };

// 'YYYY-MM' key for the calendar month a date falls in.
export function monthKeyOf(date: string): string {
  return date.slice(0, 7);
}

// Every calendar month touched by the date range, in order, as 'YYYY-MM' keys.
export function monthsInRange(start: string, end: string): string[] {
  if (!start || !end) return [];
  const months: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  cursor.setUTCDate(1);
  const last = new Date(`${end}T00:00:00Z`);
  last.setUTCDate(1);
  while (cursor <= last) {
    months.push(monthKeyOf(cursor.toISOString()));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

// A full Sun–Sat aligned grid (complete weeks, so 5 or 6 rows) covering the given month,
// including the leading/trailing days from adjacent months needed to fill each week.
export function monthGridDates(monthKey: string): string[] {
  const [year, month] = monthKey.split('-').map(Number);
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const gridStart = new Date(firstOfMonth);
  gridStart.setUTCDate(gridStart.getUTCDate() - firstOfMonth.getUTCDay());
  const lastOfMonth = new Date(Date.UTC(year, month, 0));
  const gridEnd = new Date(lastOfMonth);
  gridEnd.setUTCDate(gridEnd.getUTCDate() + (6 - lastOfMonth.getUTCDay()));

  const dates: string[] = [];
  const cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export function formatMonthLabel(monthKey: string, language: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  const formatter = new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'long',
  });
  return formatter.format(new Date(Date.UTC(year, month - 1, 1)));
}

export function todayISODate(): string {
  // Use local calendar date components, not toISOString() (which is UTC) — day cells are
  // plain calendar dates, so "today" needs to match the user's local day rather than
  // shifting a day off near midnight in non-UTC timezones.
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function datesBetween(start: string, end: string): string[] {
  if (!start || !end) return [];
  const dates: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor <= last) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export function weekdayLabel(date: string, weekdays: string[]): string {
  return weekdays[new Date(`${date}T00:00:00Z`).getUTCDay()];
}
