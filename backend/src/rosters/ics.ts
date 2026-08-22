export interface IcsEvent {
  uid: string;
  summary: string;
  description?: string;
  startDate: string;
  startTime: string;
  endTime: string;
}

function formatIcsDateTime(date: string, time: string): string {
  const [hours, minutes] = time.split(':');
  return `${date.replace(/-/g, '')}T${hours}${minutes}00`;
}

// RFC 5545 requires TEXT property values (SUMMARY, DESCRIPTION, UID, etc.) to escape backslashes,
// semicolons, and commas, and to represent embedded newlines as a literal "\n" escape sequence.
// Free-text fields here are built from shift/staff/responsibility/roster names, which are
// user-controlled — without this, a name containing e.g. a comma or semicolon corrupts the
// property parsing for strict calendar clients.
function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

export function buildIcs(events: IcsEvent[]): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Roster Creator//EN'];
  for (const event of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${escapeIcsText(event.uid)}`,
      `SUMMARY:${escapeIcsText(event.summary)}`,
      `DTSTART:${formatIcsDateTime(event.startDate, event.startTime)}`,
      `DTEND:${formatIcsDateTime(event.startDate, event.endTime)}`,
      ...(event.description ? [`DESCRIPTION:${escapeIcsText(event.description)}`] : []),
      'END:VEVENT'
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
