import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RosterListPage } from '../RosterListPage';
import { api } from '../../api/client';

vi.mock('../../api/client', () => ({
  api: { rosters: { list: vi.fn() } },
}));

describe('RosterListPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists existing rosters', async () => {
    (api.rosters.list as any).mockResolvedValue([
      {
        id: 'roster-1',
        name: 'Week 34',
        dateRangeStart: '2026-08-17T00:00:00.000Z',
        dateRangeEnd: '2026-08-23T00:00:00.000Z',
        groupId: 'group-1',
        groupName: 'Kitchen',
        status: 'draft',
        shiftCount: 4,
      },
    ]);

    render(
      <MemoryRouter>
        <RosterListPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Week 34')).toBeInTheDocument());
    expect(screen.getByText(/Kitchen/)).toBeInTheDocument();
  });
});
