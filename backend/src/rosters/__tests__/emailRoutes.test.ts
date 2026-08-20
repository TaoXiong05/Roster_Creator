import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../db', () => ({
  prisma: { roster: { findUnique: vi.fn() } },
}));
vi.mock('../../email/resend', () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));

import { prisma } from '../../db';
import { sendEmail } from '../../email/resend';
import { createApp } from '../../app';
import { signToken } from '../../auth/jwt';

const app = createApp();
const authCookie = `token=${signToken({ userId: 'user-1' })}`;

const rosterFixture = {
  id: 'roster-1',
  userId: 'user-1',
  name: 'Week 34',
  status: 'published',
  rosterShifts: [
    {
      date: new Date('2026-08-17'),
      shiftTemplate: { name: 'Morning', startTime: '06:00', endTime: '14:00' },
      assignments: [
        { staffId: 'staff-1', staff: { id: 'staff-1', name: 'Alice', email: 'alice@b.com' } },
        { staffId: 'staff-2', staff: { id: 'staff-2', name: 'Bob', email: 'bob@b.com' } },
        { staffId: null, staff: null },
      ],
    },
  ],
};

describe('POST /rosters/:id/send-emails', () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 for another user's roster", async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({ id: 'roster-1', userId: 'someone-else' });

    const res = await request(app).post('/rosters/roster-1/send-emails').set('Cookie', authCookie).send({});

    expect(res.status).toBe(404);
  });

  it('rejects sending emails when the roster is not published', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({ ...rosterFixture, status: 'preview' });

    const res = await request(app).post('/rosters/roster-1/send-emails').set('Cookie', authCookie).send({});

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Publish this roster before sending emails' });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('sends to every assigned staff member when staffIds is omitted', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue(rosterFixture);

    const res = await request(app).post('/rosters/roster-1/send-emails').set('Cookie', authCookie).send({});

    expect(res.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(res.body.sentTo.sort()).toEqual(['alice@b.com', 'bob@b.com']);
  });

  it('sends only to the requested staff member', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue(rosterFixture);

    const res = await request(app)
      .post('/rosters/roster-1/send-emails')
      .set('Cookie', authCookie)
      .send({ staffIds: ['staff-1'] });

    expect(res.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'alice@b.com', attachments: expect.any(Array) })
    );
    expect(res.body.sentTo).toEqual(['alice@b.com']);
  });

  it("isolates one recipient's failure so the rest still send and the request does not throw", async () => {
    (prisma.roster.findUnique as any).mockResolvedValue(rosterFixture);
    (sendEmail as any).mockImplementation(({ to }: { to: string }) =>
      to === 'bob@b.com' ? Promise.reject(new Error('Resend rejected this address')) : Promise.resolve(undefined)
    );

    const res = await request(app).post('/rosters/roster-1/send-emails').set('Cookie', authCookie).send({});

    expect(res.status).toBe(200);
    expect(res.body.sentTo).toEqual(['alice@b.com']);
    expect(res.body.failed).toEqual(['bob@b.com']);
  });
});
