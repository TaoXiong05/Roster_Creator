import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../db', () => ({
  prisma: {
    staffGroup: { findUnique: vi.fn() },
    staff: { findUnique: vi.fn() },
    groupMember: { findMany: vi.fn(), create: vi.fn(), delete: vi.fn() },
  },
}));

import { prisma } from '../../db';
import { createApp } from '../../app';
import { signToken } from '../../auth/jwt';

const app = createApp();
const authCookie = `token=${signToken({ userId: 'user-1' })}`;

describe('GET /groups/:id/members', () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 for another user's group", async () => {
    (prisma.staffGroup.findUnique as any).mockResolvedValue({ id: 'group-1', userId: 'someone-else' });

    const res = await request(app).get('/groups/group-1/members').set('Cookie', authCookie);

    expect(res.status).toBe(404);
  });

  it('lists the staff in the group, including each member\'s preference', async () => {
    (prisma.staffGroup.findUnique as any).mockResolvedValue({ id: 'group-1', userId: 'user-1' });
    (prisma.groupMember.findMany as any).mockResolvedValue([
      {
        groupId: 'group-1',
        staffId: 'staff-1',
        staff: { id: 'staff-1', name: 'Alice', preference: { minHours: 10, maxHours: 30 } },
      },
    ]);

    const res = await request(app).get('/groups/group-1/members').set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 'staff-1', name: 'Alice', preference: { minHours: 10, maxHours: 30 } }]);
    expect(prisma.groupMember.findMany).toHaveBeenCalledWith({
      where: { groupId: 'group-1' },
      include: { staff: { include: { preference: true } } },
    });
  });
});

describe('POST /groups/:id/members', () => {
  beforeEach(() => vi.clearAllMocks());

  it('adds a staff member owned by the current user', async () => {
    (prisma.staffGroup.findUnique as any).mockResolvedValue({ id: 'group-1', userId: 'user-1' });
    (prisma.staff.findUnique as any).mockResolvedValue({ id: 'staff-1', userId: 'user-1' });
    (prisma.groupMember.create as any).mockResolvedValue({ groupId: 'group-1', staffId: 'staff-1' });

    const res = await request(app)
      .post('/groups/group-1/members')
      .set('Cookie', authCookie)
      .send({ staffId: 'staff-1' });

    expect(res.status).toBe(201);
    expect(prisma.groupMember.create).toHaveBeenCalledWith({ data: { groupId: 'group-1', staffId: 'staff-1' } });
  });

  it('rejects a staff member owned by another user', async () => {
    (prisma.staffGroup.findUnique as any).mockResolvedValue({ id: 'group-1', userId: 'user-1' });
    (prisma.staff.findUnique as any).mockResolvedValue({ id: 'staff-1', userId: 'someone-else' });

    const res = await request(app)
      .post('/groups/group-1/members')
      .set('Cookie', authCookie)
      .send({ staffId: 'staff-1' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /groups/:id/members/:staffId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('removes a member from the group', async () => {
    (prisma.staffGroup.findUnique as any).mockResolvedValue({ id: 'group-1', userId: 'user-1' });
    (prisma.groupMember.delete as any).mockResolvedValue({ groupId: 'group-1', staffId: 'staff-1' });

    const res = await request(app).delete('/groups/group-1/members/staff-1').set('Cookie', authCookie);

    expect(res.status).toBe(204);
    expect(prisma.groupMember.delete).toHaveBeenCalledWith({
      where: { groupId_staffId: { groupId: 'group-1', staffId: 'staff-1' } },
    });
  });

  it('returns 404 instead of hanging when the membership no longer exists', async () => {
    (prisma.staffGroup.findUnique as any).mockResolvedValue({ id: 'group-1', userId: 'user-1' });
    const notFoundError = Object.assign(new Error('Record to delete does not exist'), { code: 'P2025' });
    (prisma.groupMember.delete as any).mockRejectedValue(notFoundError);

    const res = await request(app).delete('/groups/group-1/members/staff-1').set('Cookie', authCookie);

    expect(res.status).toBe(404);
  });
});
