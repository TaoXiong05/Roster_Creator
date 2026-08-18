import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from '../../db';
import { findOrCreateGoogleUser } from '../passport';

const profile = { id: 'google-1', emails: [{ value: 'a@b.com' }] } as any;

describe('findOrCreateGoogleUser', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns existing user matched by googleId', async () => {
    (prisma.user.findUnique as any).mockResolvedValueOnce({ id: 'user-1', googleId: 'google-1' });

    const user = await findOrCreateGoogleUser(profile);

    expect(user).toEqual({ id: 'user-1', googleId: 'google-1' });
  });

  it('links googleId to an existing email-only user', async () => {
    (prisma.user.findUnique as any)
      .mockResolvedValueOnce(null) // no match by googleId
      .mockResolvedValueOnce({ id: 'user-1', email: 'a@b.com', googleId: null }); // match by email
    (prisma.user.update as any).mockResolvedValue({ id: 'user-1', email: 'a@b.com', googleId: 'google-1' });

    const user = await findOrCreateGoogleUser(profile);

    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { googleId: 'google-1' } });
    expect(user.googleId).toBe('google-1');
  });

  it('creates a brand new user when none exists', async () => {
    (prisma.user.findUnique as any).mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    (prisma.user.create as any).mockResolvedValue({ id: 'user-2', email: 'a@b.com', googleId: 'google-1' });

    const user = await findOrCreateGoogleUser(profile);

    expect(prisma.user.create).toHaveBeenCalledWith({ data: { email: 'a@b.com', googleId: 'google-1' } });
    expect(user.id).toBe('user-2');
  });

  it('throws when the google profile has no email', async () => {
    await expect(findOrCreateGoogleUser({ id: 'google-1', emails: [] } as any)).rejects.toThrow('no email');
  });
});
