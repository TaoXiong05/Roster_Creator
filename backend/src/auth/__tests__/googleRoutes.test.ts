import { describe, it, expect, vi } from 'vitest';
import { handleGoogleCallback } from '../googleRoutes';

describe('handleGoogleCallback', () => {
  it('signs a JWT cookie and redirects to the dashboard', () => {
    const req = { user: { id: 'user-1' } } as any;
    const cookie = vi.fn();
    const redirect = vi.fn();
    const res = { cookie, redirect } as any;

    handleGoogleCallback(req, res);

    expect(cookie).toHaveBeenCalledWith('token', expect.any(String), expect.objectContaining({ httpOnly: true }));
    expect(redirect).toHaveBeenCalledWith(expect.stringContaining('/dashboard'));
  });
});
