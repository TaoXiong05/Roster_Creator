import { describe, it, expect } from 'vitest';
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