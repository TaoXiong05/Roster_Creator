// frontend/src/auth/__tests__/AuthContext.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';
import { api } from '../../api/client';

vi.mock('../../api/client', () => ({
  api: {
    me: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  },
}));

function Probe() {
  const { user, loading } = useAuth();
  if (loading) return <div>loading</div>;
  return <div>{user ? `logged in as ${user.email}` : 'logged out'}</div>;
}

describe('AuthProvider', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads the current user on mount', async () => {
    (api.me as any).mockResolvedValue({ id: 'user-1', email: 'a@b.com' });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText('logged in as a@b.com')).toBeInTheDocument());
  });

  it('shows logged out when /me fails', async () => {
    (api.me as any).mockRejectedValue(new Error('Not authenticated'));

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText('logged out')).toBeInTheDocument());
  });
});
