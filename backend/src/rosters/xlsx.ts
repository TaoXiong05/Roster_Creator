import ExcelJS from 'exceljs';
import { toDisplayDate } from './dateFormat';
import { groupRowsByDate, groupRowsByShift, groupRowsByWeek, weekdayOf } from './rosterGrouping';

export interface XlsxRow {
  date: string;
  shiftName: string;
  responsibilityName: string;
  startTime: string;
  endTime: string;
  staffName: string;
  // True when the slot has no staff assigned (an unfilled gap in the roster).
  unfilled?: boolean;
}

// Matches the app's own brand palette (frontend/tailwind.config.js), plus the standard Tailwind
// red already used for danger/unfilled states elsewhere in the app (e.g. styles/ui.ts btnDanger) —
// kept apart from the tan week/day bands so an unfilled row doesn't blend into the surrounding structure.
const COLORS = {
  headerBg: 'FFB04D22',
  headerText: 'FFFFFFFF',
  weekBg: 'FFFCE8CE',
  weekText: 'FFB04D22',
  dayBg: 'FFFFF3E2',
  dayText: 'FF6B5647',
  ink: 'FF3A2B22',
  border: 'FFE6DDD3',
  unfilledBg: 'FFFEF2F2',
  unfilledText: 'FFB91C1C',
  unfilledBorder: 'FFFECACA',
};

const COLUMN_WIDTHS = [20, 10, 10, 10, 28]; // Shift, Role, Start, End, Staff

function thinBorder(colorArgb: string) {
  const side: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: colorArgb } };
  return { top: side, left: side, bottom: side, right: side };
}

// Excel sheet names can't exceed 31 characters or contain : \ / ? * [ ] — roster names are free text.
function sanitizeSheetName(name: string): string {
  const cleaned = name.replace(/[:\\/?*[\]]/g, ' ').trim();
  return (cleaned || 'Roster').slice(0, 31);
}

export async function buildXlsx(title: string, dateRangeStart: string, rows: XlsxRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sanitizeSheetName(title), { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = COLUMN_WIDTHS.map((width) => ({ width }));

  const headerRow = sheet.addRow(['Shift', 'Role', 'Start', 'End', 'Staff']);
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
    cell.font = { color: { argb: COLORS.headerText }, bold: true };
    cell.border = thinBorder(COLORS.headerBg);
  });

  const weeks = groupRowsByWeek(dateRangeStart, rows);
  for (const week of weeks) {
    const weekRow = sheet.addRow([`Week of ${toDisplayDate(week.weekStart)} – ${toDisplayDate(week.weekEnd)}`]);
    sheet.mergeCells(weekRow.number, 1, weekRow.number, 5);
    const weekCell = weekRow.getCell(1);
    weekCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.weekBg } };
    weekCell.font = { color: { argb: COLORS.weekText }, bold: true };
    weekRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = thinBorder(COLORS.border);
    });

    for (const day of groupRowsByDate(week.rows)) {
      const dayRow = sheet.addRow([`${toDisplayDate(day.date)} (${weekdayOf(day.date)})`]);
      sheet.mergeCells(dayRow.number, 1, dayRow.number, 5);
      const dayCell = dayRow.getCell(1);
      dayCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.dayBg } };
      dayCell.font = { color: { argb: COLORS.dayText }, bold: true };
      dayCell.alignment = { indent: 1 };
      dayRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = thinBorder(COLORS.border);
      });

      for (const shift of groupRowsByShift(day.rows)) {
        for (const row of shift.rows) {
          const dataRow = sheet.addRow([shift.shiftName, row.responsibilityName, shift.startTime, shift.endTime, row.staffName]);
          const borderColor = row.unfilled ? COLORS.unfilledBorder : COLORS.border;
          dataRow.eachCell((cell) => {
            if (row.unfilled) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.unfilledBg } };
            }
            cell.font = { color: { argb: row.unfilled ? COLORS.unfilledText : COLORS.ink }, bold: !!row.unfilled };
            cell.border = thinBorder(borderColor);
          });
          dataRow.getCell(1).alignment = { indent: 2 };
        }
      }
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
