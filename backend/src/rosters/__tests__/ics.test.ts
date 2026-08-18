import { describe, it, expect } from 'vitest';
import { buildIcs } from '../ics';

describe('buildIcs', () => {
  it('produces a valid VCALENDAR wrapper with one VEVENT per entry', () => {
    const ics = buildIcs([
      { uid: 'evt-1', summary: 'Morning (Alice)', startDate: '2026-08-17', startTime: '06:00', endTime: '14:00' },
    ]);

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).toContain('UID:evt-1');
    expect(ics).toContain('SUMMARY:Morning (Alice)');
    expect(ics).toContain('DTSTART:20260817T060000');
    expect(ics).toContain('DTEND:20260817T140000');
  });

  it('produces an empty event list when given no events', () => {
    const ics = buildIcs([]);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).not.toContain('BEGIN:VEVENT');
  });
});
