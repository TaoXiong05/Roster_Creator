import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../db', () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    passwordResetToken: { create: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
  },
}));
vi.mock('../../email/resend', () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));

import { prisma } from '../../db';
import { sendEmail } from '../../email/resend';
import { createApp } from '../../app';

const app = createApp();

describe('POST /auth/password-reset/request', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends a reset email for an existing password user', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: 'user-1', email: 'a@b.com', passwordHash: 'hash' });
    (prisma.passwordResetToken.create as any).mockResolvedValue({ id: 'token-1' });

    const res = await request(app).post('/auth/password-reset/request').send({ email: 'a@b.com' });

    expect(res.status).toBe(202);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'a@b.com', subject: expect.any(String) })
    );
  });

  it('returns 202 without sending email when user does not exist (avoid leaking)', async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);

    const res = await request(app).post('/auth/password-reset/request').send({ email: 'nope@b.com' });

    expect(res.status).toBe(202);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe('POST /auth/password-reset/confirm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects an unknown token', async () => {
    (prisma.passwordResetToken.findFirst as any).mockResolvedValue(null);

    const res = await request(app).post('/auth/password-reset/confirm').send({ token: 'bad', password: 'newpass123' });

    expect(res.status).toBe(400);
  });

  it('rejects an expired token', async () => {
    (prisma.passwordResetToken.findFirst as any).mockResolvedValue({
      id: 'token-1',
      userId: 'user-1',
      expiresAt: new Date(Date.now() - 1000),
    });

    const res = await request(app).post('/auth/password-reset/confirm').send({ token: 'expired', password: 'newpass123' });

    expect(res.status).toBe(400);
  });

  it('resets the password with a valid token', async () => {
    (prisma.passwordResetToken.findFirst as any).mockResolvedValue({
      id: 'token-1',
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 1000 * 60),
    });
    (prisma.user.update as any).mockResolvedValue({ id: 'user-1' });
    (prisma.passwordResetToken.delete as any).mockResolvedValue({ id: 'token-1' });

    const res = await request(app).post('/auth/password-reset/confirm').send({ token: 'valid', password: 'newpass123' });

    expect(res.status).toBe(204);
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { passwordHash: expect.any(String) } });
    expect(prisma.passwordResetToken.delete).toHaveBeenCalledWith({ where: { id: 'token-1' } });
  });
});
