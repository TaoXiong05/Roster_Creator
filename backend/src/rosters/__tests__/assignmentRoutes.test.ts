import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../db', () => ({
  prisma: {
    roster: { findUnique: vi.fn(), update: vi.fn() },
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
  status: 'draft',
  hoursPerShift: 6,
  rosterShifts: [
    {
      id: 'rs-1',
      headcount: 2,
      responsibilityId: 'resp-1',
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
          responsibilityIds: ['resp-1'],
          preference: {
            minHours: 10,
            maxHours: 30,
            hoursPeriod: 'weekly',
            hoursUnit: 'hours',
            preferredShifts: [],
            unavailableShifts: [{ weekday: 3, shiftTemplateId: 'template-1' }],
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

  it('returns 409 without calling the ai provider when already generating', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({ ...rosterFixture, status: 'generating' });

    const res = await request(app).post('/rosters/roster-1/generate-assignments').set('Cookie', authCookie);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Already generating assignments for this roster' });
    expect(aiProvider.assignShifts).not.toHaveBeenCalled();
    expect(prisma.roster.update).not.toHaveBeenCalled();
  });

  it('returns 502, reverts the status, and makes no db changes when the ai provider fails', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue(rosterFixture);
    (aiProvider.assignShifts as any).mockRejectedValue(new Error('AI provider is not configured'));

    const res = await request(app).post('/rosters/roster-1/generate-assignments').set('Cookie', authCookie);

    expect(res.status).toBe(502);
    expect(prisma.assignment.deleteMany).not.toHaveBeenCalled();
    expect(prisma.assignment.createMany).not.toHaveBeenCalled();
    expect(prisma.roster.update).toHaveBeenCalledWith({ where: { id: 'roster-1' }, data: { status: 'generating' } });
    expect(prisma.roster.update).toHaveBeenCalledWith({ where: { id: 'roster-1' }, data: { status: 'draft' } });
  });

  it("passes the roster's hoursPerShift through to the AI context", async () => {
    (prisma.roster.findUnique as any).mockResolvedValue(rosterFixture);
    (aiProvider.assignShifts as any).mockResolvedValue({ assignments: [] });
    (prisma.assignment.findMany as any).mockResolvedValue([]);
    (prisma.roster.update as any).mockResolvedValue({ status: 'preview' });

    await request(app).post('/rosters/roster-1/generate-assignments').set('Cookie', authCookie);

    const contextArg = (aiProvider.assignShifts as any).mock.calls[0][0];
    expect(contextArg.hoursPerShift).toBe(6);
  });

  it("passes each shift's responsibilityId and each staff member's responsibilityIds through to the AI context", async () => {
    (prisma.roster.findUnique as any).mockResolvedValue(rosterFixture);
    (aiProvider.assignShifts as any).mockResolvedValue({ assignments: [] });
    (prisma.assignment.findMany as any).mockResolvedValue([]);
    (prisma.roster.update as any).mockResolvedValue({ status: 'preview' });

    await request(app).post('/rosters/roster-1/generate-assignments').set('Cookie', authCookie);

    const contextArg = (aiProvider.assignShifts as any).mock.calls[0][0];
    expect(contextArg.shifts[0].responsibilityId).toBe('resp-1');
    expect(contextArg.staff[0].responsibilityIds).toEqual(['resp-1']);
  });

  it("passes each staff member's unavailableShifts through to the AI context", async () => {
    (prisma.roster.findUnique as any).mockResolvedValue(rosterFixture);
    (aiProvider.assignShifts as any).mockResolvedValue({ assignments: [] });
    (prisma.assignment.findMany as any).mockResolvedValue([]);
    (prisma.roster.update as any).mockResolvedValue({ status: 'preview' });

    await request(app).post('/rosters/roster-1/generate-assignments').set('Cookie', authCookie);

    const contextArg = (aiProvider.assignShifts as any).mock.calls[0][0];
    expect(contextArg.staff[0].unavailableShifts).toEqual([{ weekday: 3, shiftTemplateId: 'template-1' }]);
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
    (prisma.roster.update as any).mockResolvedValue({ status: 'preview' });

    const res = await request(app).post('/rosters/roster-1/generate-assignments').set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('preview');
    expect(prisma.assignment.deleteMany).toHaveBeenCalledWith({ where: { rosterShiftId: { in: ['rs-1'] } } });
    const createArg = (prisma.assignment.createMany as any).mock.calls[0][0];
    expect(createArg.data).toHaveLength(2);
    expect(createArg.data.filter((r: any) => r.staffId === 'staff-1')).toHaveLength(1);
    expect(createArg.data.filter((r: any) => r.staffId === null)).toHaveLength(1);
    expect(res.body.assignments).toHaveLength(2);
  });

  it('ignores a hallucinated staff id but keeps the valid one and fills the rest as unfilled', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue(rosterFixture);
    (aiProvider.assignShifts as any).mockResolvedValue({
      assignments: [{ rosterShiftId: 'rs-1', staffIds: ['staff-1', 'staff-does-not-exist'] }],
    });
    (prisma.assignment.findMany as any).mockResolvedValue([
      { id: 'a-1', rosterShiftId: 'rs-1', staffId: 'staff-1', unfilledTag: null, staff: { id: 'staff-1', name: 'Alice' } },
      { id: 'a-2', rosterShiftId: 'rs-1', staffId: null, unfilledTag: null, staff: null },
    ]);
    (prisma.roster.update as any).mockResolvedValue({ status: 'preview' });

    const res = await request(app).post('/rosters/roster-1/generate-assignments').set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(prisma.assignment.deleteMany).toHaveBeenCalledWith({ where: { rosterShiftId: { in: ['rs-1'] } } });
    const createArg = (prisma.assignment.createMany as any).mock.calls[0][0];
    expect(createArg.data).toHaveLength(2);
    expect(createArg.data.filter((r: any) => r.staffId === 'staff-1')).toHaveLength(1);
    expect(createArg.data.filter((r: any) => r.staffId === null)).toHaveLength(1);
  });

  it('ignores assignments for an unknown roster shift and leaves real shifts unfilled', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue(rosterFixture);
    (aiProvider.assignShifts as any).mockResolvedValue({
      assignments: [{ rosterShiftId: 'rs-does-not-exist', staffIds: ['staff-1'] }],
    });
    (prisma.assignment.findMany as any).mockResolvedValue([
      { id: 'a-1', rosterShiftId: 'rs-1', staffId: null, unfilledTag: null, staff: null },
      { id: 'a-2', rosterShiftId: 'rs-1', staffId: null, unfilledTag: null, staff: null },
    ]);
    (prisma.roster.update as any).mockResolvedValue({ status: 'preview' });

    const res = await request(app).post('/rosters/roster-1/generate-assignments').set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(prisma.assignment.deleteMany).toHaveBeenCalledWith({ where: { rosterShiftId: { in: ['rs-1'] } } });
    const createArg = (prisma.assignment.createMany as any).mock.calls[0][0];
    expect(createArg.data).toHaveLength(2);
    expect(createArg.data.filter((r: any) => r.staffId === null)).toHaveLength(2);
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
