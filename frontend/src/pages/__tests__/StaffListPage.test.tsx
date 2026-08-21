import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { StaffListPage } from '../StaffListPage';
import { api } from '../../api/client';
import { renderWithProviders } from '../../testUtils';

vi.mock('../../api/client', () => ({
  api: {
    staff: { list: vi.fn(), remove: vi.fn() },
  },
}));

describe('StaffListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists existing staff', async () => {
    (api.staff.list as any).mockResolvedValue([
      { id: 'staff-1', name: 'Alice', email: 'alice@b.com', responsibilityIds: ['resp-1'], preference: null },
    ]);

    renderWithProviders(<StaffListPage />);

    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
  });

  it('renders create employee links routing to the create page', async () => {
    (api.staff.list as any).mockResolvedValue([]);

    renderWithProviders(<StaffListPage />);

    const links = await screen.findAllByRole('link', { name: /Add Staff/ });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toHaveAttribute('href', '/staff/new');
    }
  });
});
