import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../db', () => ({
  prisma: {
    roster: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    staffGroup: { findUnique: vi.fn() },
    shiftTemplate: { findUnique: vi.fn() },
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
          requiredSkills: [],
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
        shifts: [{ shiftTemplateId: 'template-1', dates: ['2026-08-17'], headcount: 2, requiredSkills: [] }],
      });

    expect(res.status).toBe(404);
  });

  it('rejects when a shift template does not belong to the current user', async () => {
    (prisma.staffGroup.findUnique as any).mockResolvedValue({ id: 'group-1', userId: 'user-1' });
    (prisma.shiftTemplate.findUnique as any).mockResolvedValue({ id: 'template-1', userId: 'someone-else' });

    const res = await request(app)
      .post('/rosters')
      .set('Cookie', authCookie)
      .send({
        name: 'Week 34',
        dateRangeStart: '2026-08-17',
        dateRangeEnd: '2026-08-23',
        groupId: 'group-1',
        shifts: [{ shiftTemplateId: 'template-1', dates: ['2026-08-17'], headcount: 2, requiredSkills: [] }],
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
    (prisma.shiftTemplate.findUnique as any).mockResolvedValue({ id: 'template-1', userId: 'user-1' });
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
            headcount: 3,
            requiredSkills: ['cashier'],
          },
        ],
      });

    expect(res.status).toBe(201);
    const callArg = (prisma.roster.create as any).mock.calls[0][0];
    expect(callArg.data.rosterShifts.create).toHaveLength(2);
    expect(callArg.data.rosterShifts.create[0]).toMatchObject({
      shiftTemplateId: 'template-1',
      headcount: 3,
      requiredSkills: ['cashier'],
    });
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
    (prisma.roster.findUnique as any).mockResolvedValue({ id: 'roster-1', userId: 'user-1' });
    (prisma.roster.update as any).mockResolvedValue({ id: 'roster-1', status: 'published' });

    const res = await request(app).put('/rosters/roster-1/publish').set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('published');
    expect(prisma.roster.update).toHaveBeenCalledWith({ where: { id: 'roster-1' }, data: { status: 'published' } });
  });
});
