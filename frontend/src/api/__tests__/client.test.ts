// frontend/src/api/__tests__/client.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '../client';

describe('api.login', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('posts credentials and returns the user on success', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'user-1', email: 'a@b.com' }),
    });

    const user = await api.login('a@b.com', 'password123');

    expect(user).toEqual({ id: 'user-1', email: 'a@b.com' });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/login'),
      expect.objectContaining({ method: 'POST', credentials: 'include' })
    );
  });

  it('throws the server error message on failure', async () => {
    (fetch as any).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Invalid credentials' }),
    });

    await expect(api.login('a@b.com', 'wrong')).rejects.toThrow('Invalid credentials');
  });
});
