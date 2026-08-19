import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../db', () => ({
  prisma: {
    roster: { findUnique: vi.fn() },
    rosterShift: { findMany: vi.fn() },
    assignment: { deleteMany: vi.fn(), createMany: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    staff: { findMany: vi.fn() },
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
  },
}));
vi.mock('../../ai/provider', () => ({ aiProvider: { assignShifts: vi.fn() } }));

import { prisma } from '../../db';
import { aiProvider } from '../../ai/provider';
import { createApp } from '../../app';
import { signToken } from '../../auth/jwt';

const app = createApp();
const authCookie = `token=${signToken({ userId: 'user-1' })}`;

const rosterFixture = {
  id: 'roster-1',
  userId: 'user-1',
  hoursPerShift: 6,
  rosterShifts: [
    {
      id: 'rs-1',
      headcount: 2,
      requiredSkills: [],
      date: new Date('2026-08-17'),
      shiftTemplate: { startTime: '06:00', endTime: '14:00' },
    },
  ],
  group: {
    members: [
      {
        staff: {
          id: 'staff-1',
          name: 'Alice',
          preference: {
            minHours: 10,
            maxHours: 30,
            hoursPeriod: 'weekly',
            hoursUnit: 'hours',
            preferredShifts: [],
            unavailableDateRanges: [],
          },
        },
      },
    ],
  },
};

describe('POST /rosters/:id/generate-assignments', () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 for another user's roster", async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({ id: 'roster-1', userId: 'someone-else' });

    const res = await request(app).post('/rosters/roster-1/generate-assignments').set('Cookie', authCookie);

    expect(res.status).toBe(404);
  });

  it('returns 502 and makes no db changes when the ai provider fails', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue(rosterFixture);
    (aiProvider.assignShifts as any).mockRejectedValue(new Error('AI provider is not configured'));

    const res = await request(app).post('/rosters/roster-1/generate-assignments').set('Cookie', authCookie);

    expect(res.status).toBe(502);
    expect(prisma.assignment.deleteMany).not.toHaveBeenCalled();
    expect(prisma.assignment.createMany).not.toHaveBeenCalled();
  });

  it("passes the roster's hoursPerShift through to the AI context", async () => {
    (prisma.roster.findUnique as any).mockResolvedValue(rosterFixture);
    (aiProvider.assignShifts as any).mockResolvedValue({ assignments: [] });
    (prisma.assignment.findMany as any).mockResolvedValue([]);

    await request(app).post('/rosters/roster-1/generate-assignments').set('Cookie', authCookie);

    const contextArg = (aiProvider.assignShifts as any).mock.calls[0][0];
    expect(contextArg.hoursPerShift).toBe(6);
  });

  it('replaces assignments and fills unfilled slots when ai returns fewer staff than headcount', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue(rosterFixture);
    (aiProvider.assignShifts as any).mockResolvedValue({
      assignments: [{ rosterShiftId: 'rs-1', staffIds: ['staff-1'] }],
    });
    (prisma.assignment.findMany as any).mockResolvedValue([
      { id: 'a-1', rosterShiftId: 'rs-1', staffId: 'staff-1', unfilledTag: null, staff: { id: 'staff-1', name: 'Alice' } },
      { id: 'a-2', rosterShiftId: 'rs-1', staffId: null, unfilledTag: null, staff: null },
    ]);

    const res = await request(app).post('/rosters/roster-1/generate-assignments').set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(prisma.assignment.deleteMany).toHaveBeenCalledWith({ where: { rosterShiftId: { in: ['rs-1'] } } });
    const createArg = (prisma.assignment.createMany as any).mock.calls[0][0];
    expect(createArg.data).toHaveLength(2);
    expect(createArg.data.filter((r: any) => r.staffId === 'staff-1')).toHaveLength(1);
    expect(createArg.data.filter((r: any) => r.staffId === null)).toHaveLength(1);
    expect(res.body.assignments).toHaveLength(2);
  });

  it('returns 502 and makes no db changes when the ai hallucinates a staff id', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue(rosterFixture);
    (aiProvider.assignShifts as any).mockResolvedValue({
      assignments: [{ rosterShiftId: 'rs-1', staffIds: ['staff-does-not-exist'] }],
    });

    const res = await request(app).post('/rosters/roster-1/generate-assignments').set('Cookie', authCookie);

    expect(res.status).toBe(502);
    expect(prisma.assignment.deleteMany).not.toHaveBeenCalled();
    expect(prisma.assignment.createMany).not.toHaveBeenCalled();
  });

  it('returns 502 and makes no db changes when the ai references an unknown roster shift', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue(rosterFixture);
    (aiProvider.assignShifts as any).mockResolvedValue({
      assignments: [{ rosterShiftId: 'rs-does-not-exist', staffIds: [] }],
    });

    const res = await request(app).post('/rosters/roster-1/generate-assignments').set('Cookie', authCookie);

    expect(res.status).toBe(502);
    expect(prisma.assignment.deleteMany).not.toHaveBeenCalled();
    expect(prisma.assignment.createMany).not.toHaveBeenCalled();
  });
});

describe('PUT /rosters/:id/assignments', () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 for another user's roster", async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({ id: 'roster-1', userId: 'someone-else' });

    const res = await request(app)
      .put('/rosters/roster-1/assignments')
      .set('Cookie', authCookie)
      .send({ assignments: [{ id: 'a-1', staffId: 'staff-1', unfilledTag: null }] });

    expect(res.status).toBe(404);
  });

  it('rejects an assignment that does not belong to this roster', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({ id: 'roster-1', userId: 'user-1' });
    (prisma.rosterShift.findMany as any).mockResolvedValue([{ id: 'rs-1' }]);
    (prisma.assignment.findMany as any).mockResolvedValue([{ id: 'a-1', rosterShiftId: 'rs-other' }]);

    const res = await request(app)
      .put('/rosters/roster-1/assignments')
      .set('Cookie', authCookie)
      .send({ assignments: [{ id: 'a-1', staffId: 'staff-1', unfilledTag: null }] });

    expect(res.status).toBe(404);
    expect(prisma.assignment.update).not.toHaveBeenCalled();
  });

  it('updates each assignment and returns the refreshed list', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({ id: 'roster-1', userId: 'user-1' });
    (prisma.rosterShift.findMany as any).mockResolvedValue([{ id: 'rs-1' }]);
    (prisma.assignment.findMany as any)
      .mockResolvedValueOnce([{ id: 'a-1', rosterShiftId: 'rs-1' }])
      .mockResolvedValueOnce([{ id: 'a-1', rosterShiftId: 'rs-1', staffId: 'staff-2', unfilledTag: null, staff: { id: 'staff-2', name: 'Bob' } }]);
    (prisma.staff.findMany as any).mockResolvedValue([{ id: 'staff-2', userId: 'user-1' }]);
    (prisma.assignment.update as any).mockResolvedValue({});

    const res = await request(app)
      .put('/rosters/roster-1/assignments')
      .set('Cookie', authCookie)
      .send({ assignments: [{ id: 'a-1', staffId: 'staff-2', unfilledTag: null }] });

    expect(res.status).toBe(200);
    expect(prisma.assignment.update).toHaveBeenCalledWith({
      where: { id: 'a-1' },
      data: { staffId: 'staff-2', unfilledTag: null },
    });
    expect(res.body.assignments[0].staffId).toBe('staff-2');
  });

  it("rejects a staffId that belongs to another user's staff record", async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({ id: 'roster-1', userId: 'user-1' });
    (prisma.rosterShift.findMany as any).mockResolvedValue([{ id: 'rs-1' }]);
    (prisma.assignment.findMany as any).mockResolvedValue([{ id: 'a-1', rosterShiftId: 'rs-1' }]);
    (prisma.staff.findMany as any).mockResolvedValue([{ id: 'staff-foreign', userId: 'someone-else' }]);

    const res = await request(app)
      .put('/rosters/roster-1/assignments')
      .set('Cookie', authCookie)
      .send({ assignments: [{ id: 'a-1', staffId: 'staff-foreign', unfilledTag: null }] });

    expect(res.status).toBe(404);
    expect(prisma.assignment.update).not.toHaveBeenCalled();
  });
});
