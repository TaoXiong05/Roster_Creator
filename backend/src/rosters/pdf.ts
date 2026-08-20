import PDFDocument from 'pdfkit';
import { toDisplayDate } from './dateFormat';

export interface PdfRow {
  date: string;
  shiftName: string;
  responsibilityName: string;
  startTime: string;
  endTime: string;
  staffName: string;
}

export interface WeekGroup<T> {
  weekStart: string;
  weekEnd: string;
  rows: T[];
}

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function weekdayOf(isoDate: string): string {
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
// date order, so the PDF can print one heading per day instead of repeating the date on every line.
function groupRowsByDate<T extends { date: string }>(rows: T[]): { date: string; rows: T[] }[] {
  const byDate = new Map<string, T[]>();
  for (const row of rows) {
    const list = byDate.get(row.date) ?? [];
    list.push(row);
    byDate.set(row.date, list);
  }
  return [...byDate.entries()].map(([date, dateRows]) => ({ date, rows: dateRows }));
}

export function buildPdf(title: string, dateRangeStart: string, rows: PdfRow[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const weeks = groupRowsByWeek(dateRangeStart, rows);

    if (weeks.length === 0) {
      doc.fontSize(18).text(title, { align: 'left' });
      doc.moveDown();
      doc.fontSize(10).text('No shifts scheduled.');
    }

    weeks.forEach((week, index) => {
      if (index > 0) doc.addPage();
      doc.fontSize(18).text(title, { align: 'left' });
      doc.fontSize(11).fillColor('#666666').text(`${toDisplayDate(week.weekStart)} - ${toDisplayDate(week.weekEnd)}`);
      doc.fillColor('#000000');
      doc.moveDown();

      for (const day of groupRowsByDate(week.rows)) {
        doc.fontSize(12).text(`${toDisplayDate(day.date)} (${weekdayOf(day.date)})`, { underline: true });
        doc.fontSize(10);
        for (const row of day.rows) {
          // Extra spacing after each line leaves room for the printed page to be marked up by hand.
          doc.text(`   ${row.shiftName} · ${row.responsibilityName} (${row.startTime}-${row.endTime})  —  ${row.staffName}`);
          doc.moveDown(0.5);
        }
        doc.moveDown(0.5);
      }
    });

    doc.end();
  });
}
