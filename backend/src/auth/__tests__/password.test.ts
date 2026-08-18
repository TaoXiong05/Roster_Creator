import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../password';

describe('password hashing', () => {
  it('hashes a password and verifies it correctly', async () => {
    const hash = await hashPassword('mysecret123');
    expect(hash).not.toBe('mysecret123');
    const ok = await verifyPassword('mysecret123', hash);
    expect(ok).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('mysecret123');
    const ok = await verifyPassword('wrongpassword', hash);
    expect(ok).toBe(false);
  });
});