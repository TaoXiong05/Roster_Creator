import PDFDocument from 'pdfkit';
import { toDisplayDate } from './dateFormat';
import { groupRowsByDate, groupRowsByShift, groupRowsByWeek, weekdayOf } from './rosterGrouping';

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
