import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RosterDetailPage } from '../RosterDetailPage';
import { api } from '../../api/client';

vi.mock('../../api/client', () => ({
  api: { rosters: { get: vi.fn() } },
}));

describe('RosterDetailPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the roster shifts', async () => {
    (api.rosters.get as any).mockResolvedValue({
      id: 'roster-1',
      name: 'Week 34',
      dateRangeStart: '2026-08-17T00:00:00.000Z',
      dateRangeEnd: '2026-08-23T00:00:00.000Z',
      groupId: 'group-1',
      status: 'draft',
      rosterShifts: [
        {
          id: 'rs-1',
          date: '2026-08-17T00:00:00.000Z',
          headcount: 3,
          requiredSkills: ['cashier'],
          shiftTemplate: { id: 'template-1', name: 'Morning', startTime: '06:00', endTime: '14:00' },
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={['/rosters/roster-1']}>
        <Routes>
          <Route path="/rosters/:id" element={<RosterDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText(/Morning/)).toBeInTheDocument());
    expect(screen.getByText(/需要 3 人/)).toBeInTheDocument();
  });
});
