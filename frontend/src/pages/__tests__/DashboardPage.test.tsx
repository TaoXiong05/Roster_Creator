// frontend/src/pages/__tests__/DashboardPage.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardPage } from '../DashboardPage';
import * as AuthContextModule from '../../auth/AuthContext';

describe('DashboardPage', () => {
  it('shows the logged-in user email', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 'user-1', email: 'a@b.com' },
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });

    render(<DashboardPage />);

    expect(screen.getByText(/a@b.com/)).toBeInTheDocument();
  });
});