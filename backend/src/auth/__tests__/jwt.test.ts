import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { signToken, verifyToken } from '../jwt';

describe('jwt', () => {
  it('signs and verifies a valid token', () => {
    const token = signToken({ userId: 'user-1' });
    const payload = verifyToken(token);
    expect(payload).toEqual({ userId: 'user-1' });
  });

  it('returns null for an invalid token', () => {
    const payload = verifyToken('not-a-real-token');
    expect(payload).toBeNull();
  });
});

describe('jwt module load without JWT_SECRET', () => {
  const originalSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    delete process.env.JWT_SECRET;
    vi.resetModules();
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
    vi.resetModules();
  });

  it('throws at import time instead of silently using a known default secret', async () => {
    await expect(import('../jwt')).rejects.toThrow('JWT_SECRET environment variable is required');
  });
});