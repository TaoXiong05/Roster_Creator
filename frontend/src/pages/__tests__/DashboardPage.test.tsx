// frontend/src/pages/__tests__/DashboardPage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from '../DashboardPage';
import * as AuthContextModule from '../../auth/AuthContext';
import { api } from '../../api/client';
import { wrapWithQueryClient } from '../../testUtils';

vi.mock('../../api/client', () => ({
  api: {
    staff: { list: vi.fn() },
    groups: { list: vi.fn() },
    shiftTemplates: { list: vi.fn() },
    rosters: { list: vi.fn() },
  },
}));

function renderPage() {
  return render(
    wrapWithQueryClient(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )
  );
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 'user-1', email: 'a@b.com' },
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      demoLogin: vi.fn(),
      logout: vi.fn(),
    });
    (api.staff.list as any).mockResolvedValue([]);
    (api.groups.list as any).mockResolvedValue([]);
    (api.shiftTemplates.list as any).mockResolvedValue([]);
    (api.rosters.list as any).mockResolvedValue([]);
  });

  it('greets the logged-in user by their email name', async () => {
    renderPage();

    expect(screen.getByText(/Hi there, a/)).toBeInTheDocument();
    await waitFor(() => expect(api.staff.list).toHaveBeenCalled());
  });

  it('shows real counts fetched from the four list endpoints', async () => {
    (api.staff.list as any).mockResolvedValue([{ id: '1' }, { id: '2' }]);
    (api.groups.list as any).mockResolvedValue([{ id: 'g1' }]);
    (api.shiftTemplates.list as any).mockResolvedValue([]);
    (api.rosters.list as any).mockResolvedValue([{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }]);

    renderPage();

    expect(await screen.findByText('2')).toBeInTheDocument(); // staff count
    expect(screen.getByText('1')).toBeInTheDocument(); // groups count
    expect(screen.getByText('0')).toBeInTheDocument(); // shift templates count
    expect(screen.getByText('3')).toBeInTheDocument(); // rosters count
  });
});
