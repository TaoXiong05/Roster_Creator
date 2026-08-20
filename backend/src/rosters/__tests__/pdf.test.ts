import { describe, it, expect } from 'vitest';
import { buildPdf, groupRowsByWeek } from '../pdf';

describe('buildPdf', () => {
  it('produces a valid PDF buffer', async () => {
    const buffer = await buildPdf('Week 34', '2026-08-17', [
      {
        date: '2026-08-17',
        shiftName: 'Morning',
        responsibilityName: 'Cashier',
        startTime: '06:00',
        endTime: '14:00',
        staffName: 'Alice',
      },
    ]);

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('produces a valid PDF buffer even with no rows', async () => {
    const buffer = await buildPdf('Week 34', '2026-08-17', []);

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });
});

describe('groupRowsByWeek', () => {
  const row = (date: string) => ({
    date,
    shiftName: 'Morning',
    startTime: '06:00',
    endTime: '14:00',
    staffName: 'Alice',
  });

  it('keeps rows within the first 7 days on one page', () => {
    const weeks = groupRowsByWeek('2026-08-17', [row('2026-08-17'), row('2026-08-20'), row('2026-08-23')]);

    expect(weeks).toHaveLength(1);
    expect(weeks[0]).toMatchObject({ weekStart: '2026-08-17', weekEnd: '2026-08-23' });
    expect(weeks[0].rows).toHaveLength(3);
  });

  it('splits rows spanning multiple weeks into separate groups, one per week', () => {
    const weeks = groupRowsByWeek('2026-08-17', [row('2026-08-17'), row('2026-08-24'), row('2026-09-07')]);

    expect(weeks).toHaveLength(3);
    expect(weeks.map((w) => w.weekStart)).toEqual(['2026-08-17', '2026-08-24', '2026-09-07']);
    expect(weeks.every((w) => w.rows.length === 1)).toBe(true);
  });

  it('omits weeks with no rows and sorts rows within a week by date', () => {
    const weeks = groupRowsByWeek('2026-08-17', [row('2026-08-19'), row('2026-08-17'), row('2026-09-10')]);

    expect(weeks).toHaveLength(2);
    expect(weeks[0].rows.map((r) => r.date)).toEqual(['2026-08-17', '2026-08-19']);
  });

  it('returns an empty array for no rows', () => {
    expect(groupRowsByWeek('2026-08-17', [])).toEqual([]);
  });
});
