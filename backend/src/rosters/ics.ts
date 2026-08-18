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

export function buildIcs(events: IcsEvent[]): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Roster Creator//EN'];
  for (const event of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.uid}`,
      `SUMMARY:${event.summary}`,
      `DTSTART:${formatIcsDateTime(event.startDate, event.startTime)}`,
      `DTEND:${formatIcsDateTime(event.startDate, event.endTime)}`,
      ...(event.description ? [`DESCRIPTION:${event.description}`] : []),
      'END:VEVENT'
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
