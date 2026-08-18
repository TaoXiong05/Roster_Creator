export interface CsvRow {
  date: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  staffName: string;
}

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildCsv(rows: CsvRow[]): string {
  const header = ['Date', 'Shift', 'Start', 'End', 'Staff'];
  const lines = [header.join(',')];
  for (const row of rows) {
    lines.push([row.date, row.shiftName, row.startTime, row.endTime, row.staffName].map(escapeCsvField).join(','));
  }
  return lines.join('\r\n');
}
