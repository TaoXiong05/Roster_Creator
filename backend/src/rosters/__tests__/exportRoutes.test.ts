import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../db', () => ({
  prisma: { roster: { findUnique: vi.fn() } },
}));

import { prisma } from '../../db';
import { createApp } from '../../app';
import { signToken } from '../../auth/jwt';

const app = createApp();
const authCookie = `token=${signToken({ userId: 'user-1' })}`;

const rosterFixture = {
  id: 'roster-1',
  userId: 'user-1',
  name: 'Week 34',
  rosterShifts: [
    {
      date: new Date('2026-08-17'),
      shiftTemplate: { name: 'Morning', startTime: '06:00', endTime: '14:00' },
      assignments: [
        { staffId: 'staff-1', staff: { id: 'staff-1', name: 'Alice' } },
        { staffId: null, staff: null },
      ],
    },
  ],
};

describe('GET /rosters/:id/export/ics', () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 for another user's roster", async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({ id: 'roster-1', userId: 'someone-else' });

    const res = await request(app).get('/rosters/roster-1/export/ics').set('Cookie', authCookie);

    expect(res.status).toBe(404);
  });

  it('returns an ics calendar with only assigned staff', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue(rosterFixture);

    const res = await request(app).get('/rosters/roster-1/export/ics').set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/calendar');
    expect(res.text).toContain('SUMMARY:Morning (Alice)');
    // DTSTART must stay in iCalendar's compact numeric format, not the DD/MM/YYYY display format used elsewhere.
    expect(res.text).toContain('DTSTART:20260817T060000');
  });

  it('filters to a single staff member when staffId is given', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({
      ...rosterFixture,
      rosterShifts: [
        {
          ...rosterFixture.rosterShifts[0],
          assignments: [
            { staffId: 'staff-1', staff: { id: 'staff-1', name: 'Alice' } },
            { staffId: 'staff-2', staff: { id: 'staff-2', name: 'Bob' } },
          ],
        },
      ],
    });

    const res = await request(app).get('/rosters/roster-1/export/ics?staffId=staff-2').set('Cookie', authCookie);

    expect(res.text).toContain('Bob');
    expect(res.text).not.toContain('Alice');
  });
});

describe('GET /rosters/:id/export/csv', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a csv table', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue(rosterFixture);

    const res = await request(app).get('/rosters/roster-1/export/csv').set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('Alice');
    expect(res.text).toContain('17/08/2026');
  });
});

describe('GET /rosters/:id/export/pdf', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a pdf document', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue(rosterFixture);

    const res = await request(app).get('/rosters/roster-1/export/pdf').set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
  });
});
