import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { RosterListPage } from '../RosterListPage';
import { api } from '../../api/client';

vi.mock('../../api/client', () => ({
  api: { rosters: { list: vi.fn(), remove: vi.fn() } },
}));

const rosterFixture = {
  id: 'roster-1',
  name: 'Week 34',
  dateRangeStart: '2026-08-17T00:00:00.000Z',
  dateRangeEnd: '2026-08-23T00:00:00.000Z',
  groupId: 'group-1',
  groupName: 'Kitchen',
  status: 'draft',
  shiftCount: 4,
};

describe('RosterListPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists existing rosters', async () => {
    (api.rosters.list as any).mockResolvedValue([rosterFixture]);

    render(
      <MemoryRouter>
        <RosterListPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Week 34')).toBeInTheDocument());
    expect(screen.getByText(/Kitchen/)).toBeInTheDocument();
  });

  it('renders edit and prepare-for-publish buttons routing to their pages', async () => {
    (api.rosters.list as any).mockResolvedValue([rosterFixture]);

    render(
      <MemoryRouter>
        <RosterListPage />
      </MemoryRouter>
    );

    const editLink = await screen.findByRole('link', { name: '编辑时间和偏好' });
    expect(editLink).toHaveAttribute('href', '/rosters/roster-1/edit');

    const publishLink = screen.getByRole('link', { name: '准备发布' });
    expect(publishLink).toHaveAttribute('href', '/rosters/roster-1');
  });

  it('deletes a roster after confirmation', async () => {
    (api.rosters.list as any).mockResolvedValue([rosterFixture]);
    (api.rosters.remove as any).mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <RosterListPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Week 34')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: '删除' }));
    await userEvent.click(await screen.findByRole('button', { name: '确认删除' }));

    await waitFor(() => expect(api.rosters.remove).toHaveBeenCalledWith('roster-1'));
  });
});
