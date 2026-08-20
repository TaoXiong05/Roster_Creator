import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../db', () => ({
  prisma: {
    roster: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    rosterShift: { deleteMany: vi.fn(), create: vi.fn(), createMany: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    assignment: { createMany: vi.fn(), deleteMany: vi.fn() },
    staffGroup: { findUnique: vi.fn() },
    shiftTemplate: { findUnique: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: any) => Promise<unknown>) => fn(prisma)),
  },
}));

import { prisma } from '../../db';
import { createApp } from '../../app';
import { signToken } from '../../auth/jwt';


const app = createApp();
const authCookie = `token=${signToken({ userId: 'user-1' })}`;

describe('GET /rosters', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists rosters scoped to the current user', async () => {
    (prisma.roster.findMany as any).mockResolvedValue([
      {
        id: 'roster-1',
        name: 'Week 34',
        dateRangeStart: new Date('2026-08-17'),
        dateRangeEnd: new Date('2026-08-23'),
        groupId: 'group-1',
        status: 'draft',
        group: { name: 'Kitchen' },
        _count: { rosterShifts: 4 },
      },
    ]);

    const res = await request(app).get('/rosters').set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({ id: 'roster-1', groupName: 'Kitchen', shiftCount: 4 });
  });
});

describe('GET /rosters/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 for another user's roster", async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({ id: 'roster-1', userId: 'someone-else' });

    const res = await request(app).get('/rosters/roster-1').set('Cookie', authCookie);

    expect(res.status).toBe(404);
  });

  it('returns roster detail with shifts', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({
      id: 'roster-1',
      userId: 'user-1',
      name: 'Week 34',
      rosterShifts: [
        {
          id: 'rs-1',
          date: new Date('2026-08-17'),
          headcount: 3,
          responsibilityId: 'resp-1',
          shiftTemplate: { name: 'Morning' },
        },
      ],
    });

    const res = await request(app).get('/rosters/roster-1').set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body.rosterShifts).toHaveLength(1);
  });
});

describe('POST /rosters', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects when the group does not belong to the current user', async () => {
    (prisma.staffGroup.findUnique as any).mockResolvedValue({ id: 'group-1', userId: 'someone-else' });

    const res = await request(app)
      .post('/rosters')
      .set('Cookie', authCookie)
      .send({
        name: 'Week 34',
        dateRangeStart: '2026-08-17',
        dateRangeEnd: '2026-08-23',
        groupId: 'group-1',
        shifts: [
          { shiftTemplateId: 'template-1', dates: ['2026-08-17'], requirements: [{ responsibilityId: 'resp-1', headcount: 2 }] },
        ],
      });

    expect(res.status).toBe(404);
  });

  it('rejects when a shift template does not belong to the current user', async () => {
    (prisma.staffGroup.findUnique as any).mockResolvedValue({ id: 'group-1', userId: 'user-1' });
    (prisma.shiftTemplate.findMany as any).mockResolvedValue([{ id: 'template-1', userId: 'someone-else' }]);

    const res = await request(app)
      .post('/rosters')
      .set('Cookie', authCookie)
      .send({
        name: 'Week 34',
        dateRangeStart: '2026-08-17',
        dateRangeEnd: '2026-08-23',
        groupId: 'group-1',
        shifts: [{ shiftTemplateId: 'template-1', dates: ['2026-08-17'], requirements: [{ responsibilityId: 'resp-1', headcount: 2 }] }],
      });

    expect(res.status).toBe(404);
  });

  it('rejects an empty shifts array', async () => {
    const res = await request(app)
      .post('/rosters')
      .set('Cookie', authCookie)
      .send({
        name: 'Week 34',
        dateRangeStart: '2026-08-17',
        dateRangeEnd: '2026-08-23',
        groupId: 'group-1',
        shifts: [],
      });

    expect(res.status).toBe(400);
  });

  it('creates a roster with one RosterShift per date per shift entry', async () => {
    (prisma.staffGroup.findUnique as any).mockResolvedValue({ id: 'group-1', userId: 'user-1' });
    (prisma.shiftTemplate.findMany as any).mockResolvedValue([{ id: 'template-1', userId: 'user-1' }]);
    (prisma.roster.create as any).mockResolvedValue({ id: 'roster-1' });

    const res = await request(app)
      .post('/rosters')
      .set('Cookie', authCookie)
      .send({
        name: 'Week 34',
        dateRangeStart: '2026-08-17',
        dateRangeEnd: '2026-08-23',
        groupId: 'group-1',
        shifts: [
          {
            shiftTemplateId: 'template-1',
            dates: ['2026-08-17', '2026-08-18'],
            requirements: [{ responsibilityId: 'resp-1', headcount: 3 }],
          },
        ],
      });

    expect(res.status).toBe(201);
    const rows = (prisma.rosterShift.createMany as any).mock.calls[0][0].data;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      shiftTemplateId: 'template-1',
      headcount: 3,
      responsibilityId: 'resp-1',
    });
  });

  it('creates one RosterShift per requirement when a shift has multiple responsibility requirements', async () => {
    (prisma.staffGroup.findUnique as any).mockResolvedValue({ id: 'group-1', userId: 'user-1' });
    (prisma.shiftTemplate.findMany as any).mockResolvedValue([{ id: 'template-1', userId: 'user-1' }]);
    (prisma.roster.create as any).mockResolvedValue({ id: 'roster-1' });

    const res = await request(app)
      .post('/rosters')
      .set('Cookie', authCookie)
      .send({
        name: 'Week 34',
        dateRangeStart: '2026-08-17',
        dateRangeEnd: '2026-08-23',
        groupId: 'group-1',
        shifts: [
          {
            shiftTemplateId: 'template-1',
            dates: ['2026-08-17'],
            requirements: [
              { responsibilityId: 'resp-cashier', headcount: 2 },
              { responsibilityId: 'resp-cleaning', headcount: 1 },
            ],
          },
        ],
      });

    expect(res.status).toBe(201);
    const rows = (prisma.rosterShift.createMany as any).mock.calls[0][0].data;
    expect(rows).toHaveLength(2);
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ responsibilityId: 'resp-cashier', headcount: 2 }),
        expect.objectContaining({ responsibilityId: 'resp-cleaning', headcount: 1 }),
      ])
    );
  });

  it('rejects a requirement missing a responsibilityId', async () => {
    (prisma.staffGroup.findUnique as any).mockResolvedValue({ id: 'group-1', userId: 'user-1' });
    (prisma.shiftTemplate.findMany as any).mockResolvedValue([{ id: 'template-1', userId: 'user-1' }]);

    const res = await request(app)
      .post('/rosters')
      .set('Cookie', authCookie)
      .send({
        name: 'Week 34',
        dateRangeStart: '2026-08-17',
        dateRangeEnd: '2026-08-23',
        groupId: 'group-1',
        shifts: [
          { shiftTemplateId: 'template-1', dates: ['2026-08-17'], requirements: [{ responsibilityId: '', headcount: 1 }] },
        ],
      });

    expect(res.status).toBe(400);
    expect(prisma.roster.create).not.toHaveBeenCalled();
  });

  it('rejects a shift with an empty requirements array', async () => {
    (prisma.staffGroup.findUnique as any).mockResolvedValue({ id: 'group-1', userId: 'user-1' });
    (prisma.shiftTemplate.findMany as any).mockResolvedValue([{ id: 'template-1', userId: 'user-1' }]);

    const res = await request(app)
      .post('/rosters')
      .set('Cookie', authCookie)
      .send({
        name: 'Week 34',
        dateRangeStart: '2026-08-17',
        dateRangeEnd: '2026-08-23',
        groupId: 'group-1',
        shifts: [{ shiftTemplateId: 'template-1', dates: ['2026-08-17'], requirements: [] }],
      });

    expect(res.status).toBe(400);
    expect(prisma.roster.create).not.toHaveBeenCalled();
  });

  it('pre-creates one unfilled assignment slot per headcount so shifts can be staffed manually without AI', async () => {
    (prisma.staffGroup.findUnique as any).mockResolvedValue({ id: 'group-1', userId: 'user-1' });
    (prisma.shiftTemplate.findMany as any).mockResolvedValue([{ id: 'template-1', userId: 'user-1' }]);
    (prisma.roster.create as any).mockResolvedValue({ id: 'roster-1' });

    await request(app)
      .post('/rosters')
      .set('Cookie', authCookie)
      .send({
        name: 'Week 34',
        dateRangeStart: '2026-08-17',
        dateRangeEnd: '2026-08-23',
        groupId: 'group-1',
        shifts: [{ shiftTemplateId: 'template-1', dates: ['2026-08-17'], requirements: [{ responsibilityId: 'resp-1', headcount: 3 }] }],
      });

    const assignmentRows = (prisma.assignment.createMany as any).mock.calls[0][0].data;
    expect(assignmentRows).toHaveLength(3);
    expect(assignmentRows).toEqual([
      expect.objectContaining({ staffId: null, unfilledTag: null }),
      expect.objectContaining({ staffId: null, unfilledTag: null }),
      expect.objectContaining({ staffId: null, unfilledTag: null }),
    ]);
  });

  it('defaults hoursPerShift to 8 when omitted', async () => {
    (prisma.staffGroup.findUnique as any).mockResolvedValue({ id: 'group-1', userId: 'user-1' });
    (prisma.shiftTemplate.findMany as any).mockResolvedValue([{ id: 'template-1', userId: 'user-1' }]);
    (prisma.roster.create as any).mockResolvedValue({ id: 'roster-1' });

    await request(app)
      .post('/rosters')
      .set('Cookie', authCookie)
      .send({
        name: 'Week 34',
        dateRangeStart: '2026-08-17',
        dateRangeEnd: '2026-08-23',
        groupId: 'group-1',
        shifts: [{ shiftTemplateId: 'template-1', dates: ['2026-08-17'], requirements: [{ responsibilityId: 'resp-1', headcount: 1 }] }],
      });

    const callArg = (prisma.roster.create as any).mock.calls[0][0];
    expect(callArg.data.hoursPerShift).toBe(8);
  });

  it('stores an explicit hoursPerShift', async () => {
    (prisma.staffGroup.findUnique as any).mockResolvedValue({ id: 'group-1', userId: 'user-1' });
    (prisma.shiftTemplate.findMany as any).mockResolvedValue([{ id: 'template-1', userId: 'user-1' }]);
    (prisma.roster.create as any).mockResolvedValue({ id: 'roster-1' });

    await request(app)
      .post('/rosters')
      .set('Cookie', authCookie)
      .send({
        name: 'Week 34',
        dateRangeStart: '2026-08-17',
        dateRangeEnd: '2026-08-23',
        groupId: 'group-1',
        hoursPerShift: 6,
        shifts: [{ shiftTemplateId: 'template-1', dates: ['2026-08-17'], requirements: [{ responsibilityId: 'resp-1', headcount: 1 }] }],
      });

    const callArg = (prisma.roster.create as any).mock.calls[0][0];
    expect(callArg.data.hoursPerShift).toBe(6);
  });

  it('rejects a non-positive hoursPerShift', async () => {
    const res = await request(app)
      .post('/rosters')
      .set('Cookie', authCookie)
      .send({
        name: 'Week 34',
        dateRangeStart: '2026-08-17',
        dateRangeEnd: '2026-08-23',
        groupId: 'group-1',
        hoursPerShift: 0,
        shifts: [{ shiftTemplateId: 'template-1', dates: ['2026-08-17'], requirements: [{ responsibilityId: 'resp-1', headcount: 1 }] }],
      });

    expect(res.status).toBe(400);
    expect(prisma.roster.create).not.toHaveBeenCalled();
  });

  it('rejects a date range where the start is after the end', async () => {
    const res = await request(app)
      .post('/rosters')
      .set('Cookie', authCookie)
      .send({
        name: 'Week 34',
        dateRangeStart: '2026-08-23',
        dateRangeEnd: '2026-08-17',
        groupId: 'group-1',
        shifts: [{ shiftTemplateId: 'template-1', dates: ['2026-08-18'], requirements: [{ responsibilityId: 'resp-1', headcount: 1 }] }],
      });

    expect(res.status).toBe(400);
  });

  it('rejects a shift date outside the roster date range', async () => {
    (prisma.staffGroup.findUnique as any).mockResolvedValue({ id: 'group-1', userId: 'user-1' });
    (prisma.shiftTemplate.findMany as any).mockResolvedValue([{ id: 'template-1', userId: 'user-1' }]);

    const res = await request(app)
      .post('/rosters')
      .set('Cookie', authCookie)
      .send({
        name: 'Week 34',
        dateRangeStart: '2026-08-17',
        dateRangeEnd: '2026-08-23',
        groupId: 'group-1',
        shifts: [{ shiftTemplateId: 'template-1', dates: ['2026-09-01'], requirements: [{ responsibilityId: 'resp-1', headcount: 1 }] }],
      });

    expect(res.status).toBe(400);
    expect(prisma.roster.create).not.toHaveBeenCalled();
  });
});

describe("PUT /rosters/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 for another user's roster", async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({ id: 'roster-1', userId: 'someone-else' });

    const res = await request(app).put('/rosters/roster-1').set('Cookie', authCookie).send({
      name: 'Week 35',
      dateRangeStart: '2026-08-24',
      dateRangeEnd: '2026-08-30',
      groupId: 'group-1',
      shifts: [{ shiftTemplateId: 'template-1', dates: ['2026-08-24'], requirements: [{ responsibilityId: 'resp-1', headcount: 2 }] }],
    });

    expect(res.status).toBe(404);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects when the group does not belong to the current user", async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({ id: 'roster-1', userId: 'user-1' });
    (prisma.staffGroup.findUnique as any).mockResolvedValue({ id: 'group-1', userId: 'someone-else' });

    const res = await request(app).put('/rosters/roster-1').set('Cookie', authCookie).send({
      name: 'Week 35',
      dateRangeStart: '2026-08-24',
      dateRangeEnd: '2026-08-30',
      groupId: 'group-1',
      shifts: [{ shiftTemplateId: 'template-1', dates: ['2026-08-24'], requirements: [{ responsibilityId: 'resp-1', headcount: 2 }] }],
    });

    expect(res.status).toBe(404);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects editing a roster while it is generating', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({ id: 'roster-1', userId: 'user-1', status: 'generating' });

    const res = await request(app).put('/rosters/roster-1').set('Cookie', authCookie).send({
      name: 'Week 35',
      dateRangeStart: '2026-08-24',
      dateRangeEnd: '2026-08-30',
      groupId: 'group-1',
      shifts: [{ shiftTemplateId: 'template-1', dates: ['2026-08-24'], requirements: [{ responsibilityId: 'resp-1', headcount: 2 }] }],
    });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Cannot edit a roster while it is generating' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("updates roster fields and creates shifts that didn't exist before", async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({ id: 'roster-1', userId: 'user-1', hoursPerShift: 8 });
    (prisma.staffGroup.findUnique as any).mockResolvedValue({ id: 'group-1', userId: 'user-1' });
    (prisma.shiftTemplate.findMany as any).mockResolvedValue([{ id: 'template-1', userId: 'user-1' }]);
    (prisma.roster.update as any).mockResolvedValue({ id: 'roster-1', name: 'Week 35' });
    (prisma.rosterShift.findMany as any).mockResolvedValue([]);
    (prisma.rosterShift.createMany as any).mockResolvedValue({ count: 1 });
    (prisma.assignment.createMany as any).mockResolvedValue({ count: 2 });

    const res = await request(app).put('/rosters/roster-1').set('Cookie', authCookie).send({
      name: 'Week 35',
      dateRangeStart: '2026-08-24',
      dateRangeEnd: '2026-08-24',
      groupId: 'group-1',
      hoursPerShift: 6,
      shifts: [
        { shiftTemplateId: 'template-1', dates: ['2026-08-24'], requirements: [{ responsibilityId: 'resp-1', headcount: 2 }] },
      ],
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 'roster-1', name: 'Week 35' });
    expect(prisma.roster.update).toHaveBeenCalledWith({
      where: { id: 'roster-1' },
      data: expect.objectContaining({
        name: 'Week 35',
        groupId: 'group-1',
        hoursPerShift: 6,
        status: 'draft',
      }),
    });
    expect(prisma.rosterShift.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          rosterId: 'roster-1',
          shiftTemplateId: 'template-1',
          responsibilityId: 'resp-1',
          headcount: 2,
        }),
      ],
    });
    expect(prisma.assignment.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ staffId: null, unfilledTag: null }),
        expect.objectContaining({ staffId: null, unfilledTag: null }),
      ],
    });
  });

  it('avoids the N+1 template lookup by fetching all referenced templates in one query', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({ id: 'roster-1', userId: 'user-1', hoursPerShift: 8 });
    (prisma.staffGroup.findUnique as any).mockResolvedValue({ id: 'group-1', userId: 'user-1' });
    (prisma.shiftTemplate.findMany as any).mockResolvedValue([
      { id: 'template-1', userId: 'user-1' },
      { id: 'template-2', userId: 'user-1' },
    ]);
    (prisma.roster.update as any).mockResolvedValue({ id: 'roster-1' });
    (prisma.rosterShift.findMany as any).mockResolvedValue([]);
    (prisma.rosterShift.createMany as any).mockResolvedValue({ count: 2 });
    (prisma.assignment.createMany as any).mockResolvedValue({ count: 2 });

    await request(app).put('/rosters/roster-1').set('Cookie', authCookie).send({
      name: 'Week 35',
      dateRangeStart: '2026-08-24',
      dateRangeEnd: '2026-08-24',
      groupId: 'group-1',
      shifts: [
        { shiftTemplateId: 'template-1', dates: ['2026-08-24'], requirements: [{ responsibilityId: 'resp-1', headcount: 1 }] },
        { shiftTemplateId: 'template-2', dates: ['2026-08-24'], requirements: [{ responsibilityId: 'resp-1', headcount: 1 }] },
      ],
    });

    expect(prisma.shiftTemplate.findMany).toHaveBeenCalledTimes(1);
  });

  it('leaves an unchanged shift and its existing assignments untouched', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({ id: 'roster-1', userId: 'user-1', hoursPerShift: 8 });
    (prisma.staffGroup.findUnique as any).mockResolvedValue({ id: 'group-1', userId: 'user-1' });
    (prisma.shiftTemplate.findMany as any).mockResolvedValue([{ id: 'template-1', userId: 'user-1' }]);
    (prisma.roster.update as any).mockResolvedValue({ id: 'roster-1', name: 'Week 35 (renamed)' });
    (prisma.rosterShift.findMany as any).mockResolvedValue([
      {
        id: 'rs-existing',
        shiftTemplateId: 'template-1',
        date: new Date('2026-08-24'),
        responsibilityId: 'resp-1',
        headcount: 2,
        assignments: [
          { id: 'a-1', staffId: 'staff-1' },
          { id: 'a-2', staffId: 'staff-2' },
        ],
      },
    ]);

    const res = await request(app).put('/rosters/roster-1').set('Cookie', authCookie).send({
      name: 'Week 35 (renamed)',
      dateRangeStart: '2026-08-24',
      dateRangeEnd: '2026-08-24',
      groupId: 'group-1',
      shifts: [
        { shiftTemplateId: 'template-1', dates: ['2026-08-24'], requirements: [{ responsibilityId: 'resp-1', headcount: 2 }] },
      ],
    });

    expect(res.status).toBe(200);
    // The existing shift's identity (template + date + responsibility) and headcount are unchanged,
    // so nothing about it — or its staffed assignments — should be touched.
    expect(prisma.rosterShift.deleteMany).not.toHaveBeenCalled();
    expect(prisma.rosterShift.update).not.toHaveBeenCalled();
    expect(prisma.assignment.deleteMany).not.toHaveBeenCalled();
    expect(prisma.assignment.createMany).not.toHaveBeenCalled();
    expect(prisma.rosterShift.createMany).not.toHaveBeenCalled();
  });

  it('deletes a shift that was removed from the input, cascading its assignments', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({ id: 'roster-1', userId: 'user-1', hoursPerShift: 8 });
    (prisma.staffGroup.findUnique as any).mockResolvedValue({ id: 'group-1', userId: 'user-1' });
    (prisma.shiftTemplate.findMany as any).mockResolvedValue([{ id: 'template-1', userId: 'user-1' }]);
    (prisma.roster.update as any).mockResolvedValue({ id: 'roster-1' });
    (prisma.rosterShift.findMany as any).mockResolvedValue([
      {
        id: 'rs-to-remove',
        shiftTemplateId: 'template-1',
        date: new Date('2026-08-24'),
        responsibilityId: 'resp-1',
        headcount: 1,
        assignments: [{ id: 'a-1', staffId: null }],
      },
    ]);

    const res = await request(app).put('/rosters/roster-1').set('Cookie', authCookie).send({
      name: 'Week 35',
      dateRangeStart: '2026-08-25',
      dateRangeEnd: '2026-08-25',
      groupId: 'group-1',
      shifts: [
        { shiftTemplateId: 'template-1', dates: ['2026-08-25'], requirements: [{ responsibilityId: 'resp-1', headcount: 1 }] },
      ],
    });

    expect(res.status).toBe(200);
    expect(prisma.rosterShift.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['rs-to-remove'] } } });
  });

  it('grows headcount on an existing shift by adding unfilled slots without touching filled ones', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({ id: 'roster-1', userId: 'user-1', hoursPerShift: 8 });
    (prisma.staffGroup.findUnique as any).mockResolvedValue({ id: 'group-1', userId: 'user-1' });
    (prisma.shiftTemplate.findMany as any).mockResolvedValue([{ id: 'template-1', userId: 'user-1' }]);
    (prisma.roster.update as any).mockResolvedValue({ id: 'roster-1' });
    (prisma.rosterShift.findMany as any).mockResolvedValue([
      {
        id: 'rs-existing',
        shiftTemplateId: 'template-1',
        date: new Date('2026-08-24'),
        responsibilityId: 'resp-1',
        headcount: 1,
        assignments: [{ id: 'a-1', staffId: 'staff-1' }],
      },
    ]);

    const res = await request(app).put('/rosters/roster-1').set('Cookie', authCookie).send({
      name: 'Week 35',
      dateRangeStart: '2026-08-24',
      dateRangeEnd: '2026-08-24',
      groupId: 'group-1',
      shifts: [
        { shiftTemplateId: 'template-1', dates: ['2026-08-24'], requirements: [{ responsibilityId: 'resp-1', headcount: 3 }] },
      ],
    });

    expect(res.status).toBe(200);
    expect(prisma.rosterShift.update).toHaveBeenCalledWith({ where: { id: 'rs-existing' }, data: { headcount: 3 } });
    expect(prisma.assignment.createMany).toHaveBeenCalledWith({
      data: [
        { rosterShiftId: 'rs-existing', staffId: null, unfilledTag: null },
        { rosterShiftId: 'rs-existing', staffId: null, unfilledTag: null },
      ],
    });
    expect(prisma.assignment.deleteMany).not.toHaveBeenCalled();
  });

  it('shrinks headcount on an existing shift by removing unfilled slots before filled ones', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({ id: 'roster-1', userId: 'user-1', hoursPerShift: 8 });
    (prisma.staffGroup.findUnique as any).mockResolvedValue({ id: 'group-1', userId: 'user-1' });
    (prisma.shiftTemplate.findMany as any).mockResolvedValue([{ id: 'template-1', userId: 'user-1' }]);
    (prisma.roster.update as any).mockResolvedValue({ id: 'roster-1' });
    (prisma.rosterShift.findMany as any).mockResolvedValue([
      {
        id: 'rs-existing',
        shiftTemplateId: 'template-1',
        date: new Date('2026-08-24'),
        responsibilityId: 'resp-1',
        headcount: 3,
        assignments: [
          { id: 'a-filled', staffId: 'staff-1' },
          { id: 'a-empty', staffId: null },
          { id: 'a-empty-2', staffId: null },
        ],
      },
    ]);

    const res = await request(app).put('/rosters/roster-1').set('Cookie', authCookie).send({
      name: 'Week 35',
      dateRangeStart: '2026-08-24',
      dateRangeEnd: '2026-08-24',
      groupId: 'group-1',
      shifts: [
        { shiftTemplateId: 'template-1', dates: ['2026-08-24'], requirements: [{ responsibilityId: 'resp-1', headcount: 2 }] },
      ],
    });

    expect(res.status).toBe(200);
    expect(prisma.rosterShift.update).toHaveBeenCalledWith({ where: { id: 'rs-existing' }, data: { headcount: 2 } });
    const deletedIds = (prisma.assignment.deleteMany as any).mock.calls[0][0].where.id.in;
    expect(deletedIds).toHaveLength(1);
    expect(deletedIds).not.toContain('a-filled');
  });
});

describe("PUT /rosters/:id/publish", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 for another user's roster", async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({ id: 'roster-1', userId: 'someone-else' });

    const res = await request(app).put('/rosters/roster-1/publish').set('Cookie', authCookie);

    expect(res.status).toBe(404);
  });

  it('marks the roster as published', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({ id: 'roster-1', userId: 'user-1', status: 'preview' });
    (prisma.roster.update as any).mockResolvedValue({ id: 'roster-1', status: 'published' });

    const res = await request(app).put('/rosters/roster-1/publish').set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('published');
    expect(prisma.roster.update).toHaveBeenCalledWith({ where: { id: 'roster-1' }, data: { status: 'published' } });
  });

  it('allows idempotent republishing when already published', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({ id: 'roster-1', userId: 'user-1', status: 'published' });
    (prisma.roster.update as any).mockResolvedValue({ id: 'roster-1', status: 'published' });

    const res = await request(app).put('/rosters/roster-1/publish').set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('published');
  });

  it('rejects publishing a draft roster', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({ id: 'roster-1', userId: 'user-1', status: 'draft' });

    const res = await request(app).put('/rosters/roster-1/publish').set('Cookie', authCookie);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Generate assignments before publishing this roster' });
    expect(prisma.roster.update).not.toHaveBeenCalled();
  });

  it('rejects publishing a roster that is still generating', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({ id: 'roster-1', userId: 'user-1', status: 'generating' });

    const res = await request(app).put('/rosters/roster-1/publish').set('Cookie', authCookie);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Generate assignments before publishing this roster' });
    expect(prisma.roster.update).not.toHaveBeenCalled();
  });
});

describe('DELETE /rosters/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 for another user's roster", async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({ id: 'roster-1', userId: 'someone-else' });

    const res = await request(app).delete('/rosters/roster-1').set('Cookie', authCookie);

    expect(res.status).toBe(404);
    expect(prisma.roster.delete).not.toHaveBeenCalled();
  });

  it('deletes the roster', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({ id: 'roster-1', userId: 'user-1' });
    (prisma.roster.delete as any).mockResolvedValue({ id: 'roster-1' });

    const res = await request(app).delete('/rosters/roster-1').set('Cookie', authCookie);

    expect(res.status).toBe(204);
    expect(prisma.roster.delete).toHaveBeenCalledWith({ where: { id: 'roster-1' } });
  });
});
