import { describe, it, expect } from 'vitest';
import { buildCsv } from '../csv';

describe('buildCsv', () => {
  it('writes a header row followed by one row per entry, including the role column', () => {
    const csv = buildCsv([
      {
        date: '2026-08-17',
        shiftName: 'Morning',
        responsibilityName: 'Cashier',
        startTime: '06:00',
        endTime: '14:00',
        staffName: 'Alice',
      },
    ]);

    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('Date,Shift,Role,Start,End,Staff');
    expect(lines[1]).toBe('2026-08-17,Morning,Cashier,06:00,14:00,Alice');
  });

  it('quotes fields containing commas', () => {
    const csv = buildCsv([
      {
        date: '2026-08-17',
        shiftName: 'Morning, Extra',
        responsibilityName: 'Cashier',
        startTime: '06:00',
        endTime: '14:00',
        staffName: 'Alice',
      },
    ]);

    expect(csv).toContain('"Morning, Extra"');
  });
});
