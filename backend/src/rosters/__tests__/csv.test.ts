import { describe, it, expect } from 'vitest';
import { buildCsv } from '../csv';

describe('buildCsv', () => {
  it('writes a header row followed by one row per entry', () => {
    const csv = buildCsv([
      { date: '2026-08-17', shiftName: 'Morning', startTime: '06:00', endTime: '14:00', staffName: 'Alice' },
    ]);

    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('Date,Shift,Start,End,Staff');
    expect(lines[1]).toBe('2026-08-17,Morning,06:00,14:00,Alice');
  });

  it('quotes fields containing commas', () => {
    const csv = buildCsv([
      { date: '2026-08-17', shiftName: 'Morning, Extra', startTime: '06:00', endTime: '14:00', staffName: 'Alice' },
    ]);

    expect(csv).toContain('"Morning, Extra"');
  });
});
