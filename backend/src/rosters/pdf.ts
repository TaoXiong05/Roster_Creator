import PDFDocument from 'pdfkit';
import { toDisplayDate } from './dateFormat';

export interface PdfRow {
  date: string;
  shiftName: string;
  responsibilityName: string;
  startTime: string;
  endTime: string;
  staffName: string;
  // True when the slot has no staff assigned (an unfilled gap in the roster).
  unfilled?: boolean;
}

export interface WeekGroup<T> {
  weekStart: string;
  weekEnd: string;
  rows: T[];
}

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Matches the app's own brand palette (frontend/tailwind.config.js) so the exported document
// reads as the same product, not a generic default-styled PDF.
const COLORS = {
  headerBg: '#B04D22',
  headerSubtitle: '#F4A97C',
  dayHeading: '#B04D22',
  dayRule: '#F4A97C',
  ink: '#3A2B22',
  inkSoft: '#6B5647',
  unfilledBg: '#FAEEDA',
  unfilledText: '#854F0B',
  footer: '#B4B2A9',
};

const PAGE_MARGIN = 40;
const HEADER_HEIGHT = 64;

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

// Groups a day's rows by shift (preserving first-seen order) so the shift name and time print
// once with its roles listed underneath, instead of repeating on every role line.
function groupRowsByShift<T extends { shiftName: string; startTime: string; endTime: string }>(
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

function drawHeader(doc: PDFKit.PDFDocument, title: string, subtitle: string) {
  doc.rect(0, 0, doc.page.width, HEADER_HEIGHT).fill(COLORS.headerBg);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(18).text(title, PAGE_MARGIN, 18);
  doc.fillColor(COLORS.headerSubtitle).font('Helvetica').fontSize(10).text(subtitle, PAGE_MARGIN, 40);
  doc.fillColor(COLORS.ink).font('Helvetica');
  doc.y = HEADER_HEIGHT + 20;
}

function drawFooter(doc: PDFKit.PDFDocument, pageNumber: number, pageCount: number) {
  // The footer sits inside the page's bottom margin — pdfkit's overflow check would otherwise
  // read that as "off the page" and silently insert a blank extra page instead of drawing here.
  const originalBottomMargin = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(COLORS.footer)
    .text(`Page ${pageNumber} of ${pageCount}`, PAGE_MARGIN, doc.page.height - 30, {
      width: doc.page.width - PAGE_MARGIN * 2,
      align: 'right',
    });
  doc.page.margins.bottom = originalBottomMargin;
}

export function buildPdf(title: string, dateRangeStart: string, rows: PdfRow[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: PAGE_MARGIN, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const weeks = groupRowsByWeek(dateRangeStart, rows);

    // A week's content sometimes overflows one page, which triggers pdfkit's automatic
    // pagination mid-flow (not just the explicit addPage() between weeks below) — the
    // 'pageAdded' listener redraws the header band on every physical page either way,
    // reusing whichever week's subtitle is currently in scope.
    let currentSubtitle = '';
    doc.on('pageAdded', () => drawHeader(doc, title, currentSubtitle));

    if (weeks.length === 0) {
      currentSubtitle = 'No shifts scheduled';
      drawHeader(doc, title, currentSubtitle);
      doc.fontSize(10).fillColor(COLORS.ink).text('No shifts scheduled.');
    }

    weeks.forEach((week, index) => {
      currentSubtitle = `${toDisplayDate(week.weekStart)} - ${toDisplayDate(week.weekEnd)}`;
      if (index > 0) {
        doc.addPage();
      } else {
        drawHeader(doc, title, currentSubtitle);
      }

      for (const day of groupRowsByDate(week.rows)) {
        doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.dayHeading).text(`${toDisplayDate(day.date)} (${weekdayOf(day.date)})`);
        const ruleY = doc.y + 2;
        doc.moveTo(PAGE_MARGIN, ruleY).lineTo(doc.page.width - PAGE_MARGIN, ruleY).lineWidth(1).strokeColor(COLORS.dayRule).stroke();
        doc.y = ruleY + 8;

        for (const shift of groupRowsByShift(day.rows)) {
          doc.font('Helvetica-Bold').fontSize(10.5).fillColor(COLORS.ink).text(shift.shiftName, PAGE_MARGIN, doc.y, { continued: true });
          doc.font('Helvetica').fillColor(COLORS.inkSoft).text(`  ${shift.startTime}-${shift.endTime}`);

          for (const row of shift.rows) {
            const indentX = PAGE_MARGIN + 14;
            // staffName already reads "UNFILLED" or "UNFILLED (AGENT)" for unfilled rows — see exportRoutes.ts.
            const label = `${row.responsibilityName}  —  ${row.staffName}`;
            doc.font(row.unfilled ? 'Helvetica-Bold' : 'Helvetica').fontSize(10);
            const y = doc.y;
            if (row.unfilled) {
              const lineHeight = doc.currentLineHeight();
              const textWidth = doc.widthOfString(label);
              doc.roundedRect(indentX - 4, y - 2, textWidth + 8, lineHeight + 4, 3).fill(COLORS.unfilledBg);
              doc.fillColor(COLORS.unfilledText);
            } else {
              doc.fillColor(COLORS.inkSoft);
            }
            doc.text(label, indentX, y);
            doc.moveDown(0.35);
          }
          doc.moveDown(0.3);
        }
        doc.moveDown(0.4);
      }
    });

    const pageRange = doc.bufferedPageRange();
    for (let i = 0; i < pageRange.count; i++) {
      doc.switchToPage(pageRange.start + i);
      drawFooter(doc, i + 1, pageRange.count);
    }

    doc.end();
  });
}
