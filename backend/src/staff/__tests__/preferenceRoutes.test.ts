import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../db', () => ({
  prisma: {
    staff: { findUnique: vi.fn() },
    preference: { upsert: vi.fn() },
  },
}));

import { prisma } from '../../db';
import { createApp } from '../../app';
import { signToken } from '../../auth/jwt';

const app = createApp();
const authCookie = `token=${signToken({ userId: 'user-1' })}`;

describe('PUT /staff/:id/preference', () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 for another user's staff", async () => {
    (prisma.staff.findUnique as any).mockResolvedValue({ id: 'staff-1', userId: 'someone-else' });

    const res = await request(app)
      .put('/staff/staff-1/preference')
      .set('Cookie', authCookie)
      .send({ minHoursPerWeek: 10, maxHoursPerWeek: 30 });

    expect(res.status).toBe(404);
  });

  it('rejects minHoursPerWeek greater than maxHoursPerWeek', async () => {
    (prisma.staff.findUnique as any).mockResolvedValue({ id: 'staff-1', userId: 'user-1' });

    const res = await request(app)
      .put('/staff/staff-1/preference')
      .set('Cookie', authCookie)
      .send({ minHoursPerWeek: 40, maxHoursPerWeek: 20 });

    expect(res.status).toBe(400);
  });

  it('upserts the preference', async () => {
    (prisma.staff.findUnique as any).mockResolvedValue({ id: 'staff-1', userId: 'user-1' });
    (prisma.preference.upsert as any).mockResolvedValue({
      id: 'pref-1',
      staffId: 'staff-1',
      preferredShiftTemplateIds: [],
      unavailableDateRanges: [],
      minHoursPerWeek: 10,
      maxHoursPerWeek: 30,
      preferredWeekdays: [1, 2, 3],
    });

    const res = await request(app)
      .put('/staff/staff-1/preference')
      .set('Cookie', authCookie)
      .send({ minHoursPerWeek: 10, maxHoursPerWeek: 30, preferredWeekdays: [1, 2, 3] });

    expect(res.status).toBe(200);
    expect(res.body.preferredWeekdays).toEqual([1, 2, 3]);
    expect(prisma.preference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { staffId: 'staff-1' } })
    );
  });
});
