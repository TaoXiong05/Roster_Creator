import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RosterListPage } from '../RosterListPage';
import { api } from '../../api/client';
import { renderWithProviders } from '../../testUtils';

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

    renderWithProviders(<RosterListPage />);

    await waitFor(() => expect(screen.getByText('Week 34')).toBeInTheDocument());
    expect(screen.getByText(/Kitchen/)).toBeInTheDocument();
    expect(screen.getByText('17/08/2026 ~ 23/08/2026')).toBeInTheDocument();
  });

  it('renders edit and prepare-for-publish buttons routing to their pages', async () => {
    (api.rosters.list as any).mockResolvedValue([rosterFixture]);

    renderWithProviders(<RosterListPage />);

    const editLink = await screen.findByRole('link', { name: 'Edit Dates & Group' });
    expect(editLink).toHaveAttribute('href', '/rosters/roster-1/edit');

    const publishLink = screen.getByRole('link', { name: 'Prepare to Publish' });
    expect(publishLink).toHaveAttribute('href', '/rosters/roster-1');
  });

  it('deletes a roster after confirmation', async () => {
    (api.rosters.list as any).mockResolvedValue([rosterFixture]);
    (api.rosters.remove as any).mockResolvedValue(undefined);

    renderWithProviders(<RosterListPage />);

    await waitFor(() => expect(screen.getByText('Week 34')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm Delete' }));

    await waitFor(() => expect(api.rosters.remove).toHaveBeenCalledWith('roster-1'));
  });
});
