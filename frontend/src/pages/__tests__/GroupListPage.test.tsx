import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GroupListPage } from '../GroupListPage';
import { api } from '../../api/client';
import { renderWithProviders } from '../../testUtils';

vi.mock('../../api/client', () => ({
  api: { groups: { list: vi.fn(), create: vi.fn(), rename: vi.fn(), remove: vi.fn() } },
}));

describe('GroupListPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists existing groups with member counts', async () => {
    (api.groups.list as any).mockResolvedValue([{ id: 'group-1', name: 'Kitchen', memberCount: 2 }]);

    renderWithProviders(<GroupListPage />);

    await waitFor(() => expect(screen.getByText('Kitchen')).toBeInTheDocument());
    expect(screen.getByText('2 members')).toBeInTheDocument();
  });

  it('creates a group from the form', async () => {
    (api.groups.list as any).mockResolvedValue([]);
    (api.groups.create as any).mockResolvedValue({ id: 'group-1', name: 'Front', memberCount: 0 });

    renderWithProviders(<GroupListPage />);

    await waitFor(() => expect(api.groups.list).toHaveBeenCalled());
    await userEvent.type(screen.getByPlaceholderText('Group name'), 'Front');
    await userEvent.click(screen.getByRole('button', { name: 'Create Group' }));

    await waitFor(() => expect(api.groups.create).toHaveBeenCalledWith('Front'));
  });
});
