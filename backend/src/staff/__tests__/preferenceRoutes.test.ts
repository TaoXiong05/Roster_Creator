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
      .send({ minHours: 10, maxHours: 30 });

    expect(res.status).toBe(404);
  });

  it('rejects minHours greater than maxHours', async () => {
    (prisma.staff.findUnique as any).mockResolvedValue({ id: 'staff-1', userId: 'user-1' });

    const res = await request(app)
      .put('/staff/staff-1/preference')
      .set('Cookie', authCookie)
      .send({ minHours: 40, maxHours: 20 });

    expect(res.status).toBe(400);
  });

  it('rejects an invalid hoursPeriod', async () => {
    (prisma.staff.findUnique as any).mockResolvedValue({ id: 'staff-1', userId: 'user-1' });

    const res = await request(app)
      .put('/staff/staff-1/preference')
      .set('Cookie', authCookie)
      .send({ minHours: 10, maxHours: 30, hoursPeriod: 'daily' });

    expect(res.status).toBe(400);
    expect(prisma.preference.upsert).not.toHaveBeenCalled();
  });

  it('rejects an invalid hoursUnit', async () => {
    (prisma.staff.findUnique as any).mockResolvedValue({ id: 'staff-1', userId: 'user-1' });

    const res = await request(app)
      .put('/staff/staff-1/preference')
      .set('Cookie', authCookie)
      .send({ minHours: 10, maxHours: 30, hoursUnit: 'days' });

    expect(res.status).toBe(400);
    expect(prisma.preference.upsert).not.toHaveBeenCalled();
  });

  it('upserts the preference, defaulting hoursPeriod to weekly and hoursUnit to hours when omitted', async () => {
    (prisma.staff.findUnique as any).mockResolvedValue({ id: 'staff-1', userId: 'user-1' });
    (prisma.preference.upsert as any).mockResolvedValue({
      id: 'pref-1',
      staffId: 'staff-1',
      preferredShifts: [{ weekday: 1, shiftTemplateId: 'template-1' }],
      unavailableDateRanges: [],
      minHours: 10,
      maxHours: 30,
      hoursPeriod: 'weekly',
      hoursUnit: 'hours',
    });

    const res = await request(app)
      .put('/staff/staff-1/preference')
      .set('Cookie', authCookie)
      .send({ minHours: 10, maxHours: 30, preferredShifts: [{ weekday: 1, shiftTemplateId: 'template-1' }] });

    expect(res.status).toBe(200);
    expect(res.body.preferredShifts).toEqual([{ weekday: 1, shiftTemplateId: 'template-1' }]);
    expect(res.body.hoursPeriod).toBe('weekly');
    expect(res.body.hoursUnit).toBe('hours');
    expect(prisma.preference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { staffId: 'staff-1' } })
    );
  });

  it('upserts the preference with an explicit shifts hoursUnit', async () => {
    (prisma.staff.findUnique as any).mockResolvedValue({ id: 'staff-1', userId: 'user-1' });
    (prisma.preference.upsert as any).mockResolvedValue({
      id: 'pref-1',
      staffId: 'staff-1',
      preferredShifts: [],
      unavailableDateRanges: [],
      minHours: 2,
      maxHours: 5,
      hoursPeriod: 'weekly',
      hoursUnit: 'shifts',
    });

    const res = await request(app)
      .put('/staff/staff-1/preference')
      .set('Cookie', authCookie)
      .send({ minHours: 2, maxHours: 5, hoursUnit: 'shifts' });

    expect(res.status).toBe(200);
    expect(prisma.preference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ hoursUnit: 'shifts' }),
        update: expect.objectContaining({ hoursUnit: 'shifts' }),
      })
    );
  });

  it('upserts the preference with an explicit fortnightly hoursPeriod', async () => {
    (prisma.staff.findUnique as any).mockResolvedValue({ id: 'staff-1', userId: 'user-1' });
    (prisma.preference.upsert as any).mockResolvedValue({
      id: 'pref-1',
      staffId: 'staff-1',
      preferredShifts: [],
      unavailableDateRanges: [],
      minHours: 20,
      maxHours: 60,
      hoursPeriod: 'fortnightly',
    });

    const res = await request(app)
      .put('/staff/staff-1/preference')
      .set('Cookie', authCookie)
      .send({ minHours: 20, maxHours: 60, hoursPeriod: 'fortnightly' });

    expect(res.status).toBe(200);
    expect(prisma.preference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ hoursPeriod: 'fortnightly' }),
        update: expect.objectContaining({ hoursPeriod: 'fortnightly' }),
      })
    );
  });

  it('rejects a malformed preferredShifts entry', async () => {
    (prisma.staff.findUnique as any).mockResolvedValue({ id: 'staff-1', userId: 'user-1' });

    const res = await request(app)
      .put('/staff/staff-1/preference')
      .set('Cookie', authCookie)
      .send({ minHours: 10, maxHours: 30, preferredShifts: [{ weekday: 9, shiftTemplateId: 'template-1' }] });

    expect(res.status).toBe(400);
    expect(prisma.preference.upsert).not.toHaveBeenCalled();
  });
});
