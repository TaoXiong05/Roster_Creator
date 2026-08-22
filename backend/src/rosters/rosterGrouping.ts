const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface WeekGroup<T> {
  weekStart: string;
  weekEnd: string;
  rows: T[];
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function weekdayOf(isoDate: string): string {
  return WEEKDAY_NAMES[new Date(`${isoDate}T00:00:00Z`).getUTCDay()];
}

// Chunks rows into consecutive 7-day windows starting at dateRangeStart — matching the "weekly"
// definition already used by the roster calendar view (a fixed-length window from the roster's
// start date, not a Mon–Sun calendar week). Weeks with no rows are omitted.
export function groupRowsByWeek<T extends { date: string }>(dateRangeStart: string, rows: T[]): WeekGroup<T>[] {
  const byWeekIndex = new Map<number, T[]>();
  for (const row of rows) {
    const daysSinceStart = Math.floor(
      (Date.parse(`${row.date}T00:00:00Z`) - Date.parse(`${dateRangeStart}T00:00:00Z`)) / 86_400_000
    );
    const weekIndex = Math.floor(daysSinceStart / 7);
    const list = byWeekIndex.get(weekIndex) ?? [];
    list.push(row);
    byWeekIndex.set(weekIndex, list);
  }

  return [...byWeekIndex.keys()]
    .sort((a, b) => a - b)
    .map((weekIndex) => {
      const weekStart = addDays(dateRangeStart, weekIndex * 7);
      return {
        weekStart,
        weekEnd: addDays(weekStart, 6),
        rows: [...byWeekIndex.get(weekIndex)!].sort((a, b) => a.date.localeCompare(b.date)),
      };
    });
}

// Groups a week's rows (already date-sorted by groupRowsByWeek) by their exact date, preserving
// date order, so each day can be printed/rendered once instead of repeating the date on every line.
export function groupRowsByDate<T extends { date: string }>(rows: T[]): { date: string; rows: T[] }[] {
  const byDate = new Map<string, T[]>();
  for (const row of rows) {
    const list = byDate.get(row.date) ?? [];
    list.push(row);
    byDate.set(row.date, list);
  }
  return [...byDate.entries()].map(([date, dateRows]) => ({ date, rows: dateRows }));
}

// Groups a day's rows by shift (preserving first-seen order) so the shift name and time can be
// shown once with its roles listed underneath, instead of repeating on every role line.
export function groupRowsByShift<T extends { shiftName: string; startTime: string; endTime: string }>(
  rows: T[]
): { shiftName: string; startTime: string; endTime: string; rows: T[] }[] {
  const order: string[] = [];
  const byShift = new Map<string, T[]>();
  for (const row of rows) {
    if (!byShift.has(row.shiftName)) order.push(row.shiftName);
    const list = byShift.get(row.shiftName) ?? [];
    list.push(row);
    byShift.set(row.shiftName, list);
  }
  return order.map((shiftName) => {
    const shiftRows = byShift.get(shiftName)!;
    return { shiftName, startTime: shiftRows[0].startTime, endTime: shiftRows[0].endTime, rows: shiftRows };
  });
}
