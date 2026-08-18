import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { GroupDetailPage } from '../GroupDetailPage';
import { api } from '../../api/client';

vi.mock('../../api/client', () => ({
  api: {
    groups: { listMembers: vi.fn(), addMember: vi.fn(), removeMember: vi.fn() },
    staff: { list: vi.fn() },
  },
}));

describe('GroupDetailPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows members and staff available to add, and can add a member', async () => {
    (api.groups.listMembers as any).mockResolvedValue([{ id: 'staff-1', name: 'Alice' }]);
    (api.staff.list as any).mockResolvedValue([
      { id: 'staff-1', name: 'Alice' },
      { id: 'staff-2', name: 'Bob' },
    ]);
    (api.groups.addMember as any).mockResolvedValue(undefined);

    render(
      <MemoryRouter initialEntries={['/groups/group-1']}>
        <Routes>
          <Route path="/groups/:id" element={<GroupDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    expect(screen.getByText('Bob')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '加入' }));

    await waitFor(() => expect(api.groups.addMember).toHaveBeenCalledWith('group-1', 'staff-2'));
  });
});
