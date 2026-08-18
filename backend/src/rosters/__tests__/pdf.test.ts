import { describe, it, expect } from 'vitest';
import { buildPdf } from '../pdf';

describe('buildPdf', () => {
  it('produces a valid PDF buffer', async () => {
    const buffer = await buildPdf('Week 34', [
      { date: '2026-08-17', shiftName: 'Morning', startTime: '06:00', endTime: '14:00', staffName: 'Alice' },
    ]);

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
