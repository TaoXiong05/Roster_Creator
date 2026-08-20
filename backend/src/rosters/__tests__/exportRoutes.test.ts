import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../db', () => ({
  prisma: { roster: { findUnique: vi.fn() }, responsibilityTemplate: { findMany: vi.fn() } },
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
  status: 'published',
  dateRangeStart: new Date('2026-08-17'),
  dateRangeEnd: new Date('2026-08-23'),
  rosterShifts: [
    {
      date: new Date('2026-08-17'),
      responsibilityId: 'resp-1',
      shiftTemplate: { name: 'Morning', startTime: '06:00', endTime: '14:00' },
      assignments: [
        { staffId: 'staff-1', staff: { id: 'staff-1', name: 'Alice' } },
        { staffId: null, staff: null, unfilledTag: null },
      ],
    },
  ],
};

function mockResponsibilities() {
  (prisma.responsibilityTemplate.findMany as any).mockResolvedValue([{ id: 'resp-1', name: 'Cashier' }]);
}

describe('GET /rosters/:id/export/ics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResponsibilities();
  });

  it("returns 404 for another user's roster", async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({ id: 'roster-1', userId: 'someone-else' });

    const res = await request(app).get('/rosters/roster-1/export/ics').set('Cookie', authCookie);

    expect(res.status).toBe(404);
  });

  it('rejects exporting when the roster is not published', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({ ...rosterFixture, status: 'preview' });

    const res = await request(app).get('/rosters/roster-1/export/ics').set('Cookie', authCookie);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Publish this roster before exporting it' });
  });

  it('returns an ics calendar with the role name and a marked entry for unfilled slots', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue(rosterFixture);

    const res = await request(app).get('/rosters/roster-1/export/ics').set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/calendar');
    expect(res.text).toContain('SUMMARY:Morning · Cashier (Alice)');
    expect(res.text).toContain('SUMMARY:⚠ UNFILLED - Morning · Cashier');
    // DTSTART must stay in iCalendar's compact numeric format, not the DD/MM/YYYY display format used elsewhere.
    expect(res.text).toContain('DTSTART:20260817T060000');
  });

  it('includes the unfilledTag in the marker when one is set', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({
      ...rosterFixture,
      rosterShifts: [
        {
          ...rosterFixture.rosterShifts[0],
          assignments: [{ staffId: null, staff: null, unfilledTag: 'PICKUP' }],
        },
      ],
    });

    const res = await request(app).get('/rosters/roster-1/export/csv').set('Cookie', authCookie);

    expect(res.text).toContain('UNFILLED (PICKUP)');
  });

  it('filters to a single staff member when staffId is given, excluding unfilled slots', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({
      ...rosterFixture,
      rosterShifts: [
        {
          ...rosterFixture.rosterShifts[0],
          assignments: [
            { staffId: 'staff-1', staff: { id: 'staff-1', name: 'Alice' } },
            { staffId: 'staff-2', staff: { id: 'staff-2', name: 'Bob' } },
            { staffId: null, staff: null, unfilledTag: null },
          ],
        },
      ],
    });

    const res = await request(app).get('/rosters/roster-1/export/ics?staffId=staff-2').set('Cookie', authCookie);

    expect(res.text).toContain('Bob');
    expect(res.text).not.toContain('Alice');
    expect(res.text).not.toContain('UNFILLED');
  });

  it('includes only unfilled slots when unfilledOnly=true', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue(rosterFixture);

    const res = await request(app).get('/rosters/roster-1/export/ics?unfilledOnly=true').set('Cookie', authCookie);

    expect(res.text).toContain('⚠ UNFILLED - Morning · Cashier');
    expect(res.text).not.toContain('(Alice)');
  });
});

describe('GET /rosters/:id/export/csv', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResponsibilities();
  });

  it('rejects exporting when the roster is not published', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({ ...rosterFixture, status: 'draft' });

    const res = await request(app).get('/rosters/roster-1/export/csv').set('Cookie', authCookie);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Publish this roster before exporting it' });
  });

  it('returns a csv table including the role column', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue(rosterFixture);

    const res = await request(app).get('/rosters/roster-1/export/csv').set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('Date,Shift,Role,Start,End,Staff');
    expect(res.text).toContain('Alice');
    expect(res.text).toContain('Cashier');
    expect(res.text).toContain('17/08/2026');
  });

  it('marks an unfilled slot in the Staff column instead of omitting the row', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue(rosterFixture);

    const res = await request(app).get('/rosters/roster-1/export/csv').set('Cookie', authCookie);

    expect(res.text).toContain('UNFILLED');
  });

  it('includes only unfilled rows when unfilledOnly=true', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue(rosterFixture);

    const res = await request(app).get('/rosters/roster-1/export/csv?unfilledOnly=true').set('Cookie', authCookie);

    const dataLines = res.text.split('\r\n').slice(1).filter(Boolean);
    expect(dataLines).toHaveLength(1);
    expect(dataLines[0]).toContain('UNFILLED');
    expect(dataLines[0]).not.toContain('Alice');
  });
});

describe('GET /rosters/:id/export/pdf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResponsibilities();
  });

  it('rejects exporting when the roster is not published', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({ ...rosterFixture, status: 'generating' });

    const res = await request(app).get('/rosters/roster-1/export/pdf').set('Cookie', authCookie);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Publish this roster before exporting it' });
  });

  it('returns a pdf document', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue(rosterFixture);

    const res = await request(app).get('/rosters/roster-1/export/pdf').set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
  });

  it('returns a pdf document when unfilledOnly=true', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue(rosterFixture);

    const res = await request(app).get('/rosters/roster-1/export/pdf?unfilledOnly=true').set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
  });
});
