import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RosterDetailPage } from '../RosterDetailPage';
import { api } from '../../api/client';

vi.mock('../../api/client', () => ({
  api: {
    rosters: {
      get: vi.fn(),
      generateAssignments: vi.fn(),
      saveAssignments: vi.fn(),
      publish: vi.fn(),
      sendEmails: vi.fn(),
      exportUrl: vi.fn((id: string, format: string, staffId?: string) =>
        `/api/rosters/${id}/export/${format}${staffId ? `?staffId=${staffId}` : ''}`
      ),
    },
    groups: { listMembers: vi.fn() },
    responsibilities: { list: vi.fn() },
  },
}));

const baseRoster = {
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
      headcount: 1,
      responsibilityId: 'resp-1',
      shiftTemplate: { id: 'template-1', name: 'Morning', startTime: '06:00', endTime: '14:00' },
      assignments: [{ id: 'a-1', rosterShiftId: 'rs-1', staffId: null, unfilledTag: null, staff: null }],
    },
  ],
};

describe('RosterDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.responsibilities.list as any).mockResolvedValue([{ id: 'resp-1', name: 'Cashier' }]);
  });

  const renderPage = () =>
    render(
      <MemoryRouter initialEntries={['/rosters/roster-1']}>
        <Routes>
          <Route path="/rosters/:id" element={<RosterDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

  it('generates assignments via the AI and shows the result', async () => {
    (api.rosters.get as any).mockResolvedValue(baseRoster);
    (api.groups.listMembers as any).mockResolvedValue([{ id: 'staff-1', name: 'Alice', email: 'a@b.com', preference: null }]);
    (api.rosters.generateAssignments as any).mockResolvedValue({
      assignments: [{ id: 'a-1', rosterShiftId: 'rs-1', staffId: 'staff-1', unfilledTag: null, staff: { id: 'staff-1', name: 'Alice', email: 'a@b.com' } }],
    });

    renderPage();

    await waitFor(() => expect(screen.getByText(/Morning/)).toBeInTheDocument());
    // The role name and unfilled count now show directly in the day cell summary instead of
    // the old table's "Role: Cashier" header row.
    expect(screen.getByText(/Cashier/)).toBeInTheDocument();
    expect(screen.getByText('⚠ 1 unfilled')).toBeInTheDocument();
    expect(screen.getByText('17/08/2026 ~ 23/08/2026')).toBeInTheDocument();
    expect(screen.getByText('17/08/2026')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Generate Roster' }));

    await waitFor(() => expect(api.rosters.generateAssignments).toHaveBeenCalledWith('roster-1'));

    // The staff select now only exists inside the day dialog, opened by clicking the day cell.
    await userEvent.click(screen.getByRole('button', { name: /17\/08\/2026/ }));
    await waitFor(() => expect(screen.getByDisplayValue('Alice')).toBeInTheDocument());
  });

  it('disables save until an edit is made, then saves the local changes', async () => {
    (api.rosters.get as any).mockResolvedValue(baseRoster);
    (api.groups.listMembers as any).mockResolvedValue([{ id: 'staff-1', name: 'Alice', email: 'a@b.com', preference: null }]);
    (api.rosters.saveAssignments as any).mockResolvedValue({
      assignments: [{ id: 'a-1', rosterShiftId: 'rs-1', staffId: 'staff-1', unfilledTag: null, staff: { id: 'staff-1', name: 'Alice', email: 'a@b.com' } }],
    });

    renderPage();

    await waitFor(() => expect(screen.getByText(/Morning/)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    // Staff assignment now happens inside the day dialog, opened by clicking the day cell.
    await userEvent.click(screen.getByRole('button', { name: /17\/08\/2026/ }));
    await waitFor(() => expect(screen.getByLabelText('Assign staff')).toBeInTheDocument());

    await userEvent.selectOptions(screen.getByLabelText('Assign staff'), 'staff-1');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(api.rosters.saveAssignments).toHaveBeenCalledWith('roster-1', [
        { id: 'a-1', staffId: 'staff-1', unfilledTag: null },
      ])
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('lets the user tag an unfilled slot', async () => {
    (api.rosters.get as any).mockResolvedValue(baseRoster);
    (api.groups.listMembers as any).mockResolvedValue([]);

    renderPage();

    await waitFor(() => expect(screen.getByText(/Morning/)).toBeInTheDocument());
    // Unfilled tagging now happens inside the day dialog, opened by clicking the day cell.
    await userEvent.click(screen.getByRole('button', { name: /17\/08\/2026/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'AGENT' })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'AGENT' }));

    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('shows an unfilled badge and amber highlight on a day cell, clearing once the slot is assigned', async () => {
    (api.rosters.get as any).mockResolvedValue(baseRoster);
    (api.groups.listMembers as any).mockResolvedValue([{ id: 'staff-1', name: 'Alice', email: 'a@b.com', preference: null }]);

    renderPage();

    await waitFor(() => expect(screen.getByText(/Morning/)).toBeInTheDocument());

    const dayCell = () => screen.getByRole('button', { name: /17\/08\/2026/ });
    expect(screen.getByText('⚠ 1 unfilled')).toBeInTheDocument();
    expect(dayCell()).toHaveClass('border-amber-400/60');

    await userEvent.click(dayCell());
    await waitFor(() => expect(screen.getByLabelText('Assign staff')).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByLabelText('Assign staff'), 'staff-1');
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // The change made inside the dialog is reflected back in the grid cell's own summary text,
    // not just inside the (now closed) dialog.
    expect(screen.queryByText('⚠ 1 unfilled')).not.toBeInTheDocument();
    expect(dayCell()).not.toHaveClass('border-amber-400/60');
    expect(within(dayCell()).getByText(/Alice/)).toBeInTheDocument();
  });

  it('renders a day with zero scheduled shifts as a non-interactive placeholder', async () => {
    (api.rosters.get as any).mockResolvedValue(baseRoster);
    (api.groups.listMembers as any).mockResolvedValue([]);

    renderPage();

    await waitFor(() => expect(screen.getByText(/Morning/)).toBeInTheDocument());

    // baseRoster only schedules a shift on 2026-08-17; the rest of the 17-23 range (6 days) has
    // no shifts at all.
    expect(screen.queryByRole('button', { name: /18\/08\/2026/ })).not.toBeInTheDocument();
    const noShiftLabels = screen.getAllByText('No shifts scheduled');
    expect(noShiftLabels.length).toBe(6);
    for (const label of noShiftLabels) {
      expect(label.closest('button')).toBeNull();
    }
  });

  it('supports the Weekly/Fortnightly/Monthly view toggle and pagination, mirroring the create page', async () => {
    const longRoster = {
      ...baseRoster,
      dateRangeStart: '2026-08-17T00:00:00.000Z',
      dateRangeEnd: '2026-09-05T00:00:00.000Z',
    };
    (api.rosters.get as any).mockResolvedValue(longRoster);
    (api.groups.listMembers as any).mockResolvedValue([]);

    renderPage();

    await waitFor(() => expect(screen.getByText(/Morning/)).toBeInTheDocument());

    // 20-day range (Aug 17 - Sep 5): 3 weekly pages, 2 fortnightly pages, 2 monthly pages.
    expect(screen.getByText('Page 1 / 3')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next →' }));
    expect(screen.getByText('Page 2 / 3')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Fortnightly' }));
    expect(screen.getByText('Page 1 / 2')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Monthly' }));
    expect(screen.getByText('August 2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /17\/08\/2026/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Next →' }));
    expect(screen.getByText('September 2026')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /17\/08\/2026/ })).not.toBeInTheDocument();
    // Only 2 months in range, so Next is now disabled.
    expect(screen.getByRole('button', { name: 'Next →' })).toBeDisabled();
  });
});

describe('RosterDetailPage publish and email actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.responsibilities.list as any).mockResolvedValue([{ id: 'resp-1', name: 'Cashier' }]);
  });

  const renderPage = () =>
    render(
      <MemoryRouter initialEntries={['/rosters/roster-1']}>
        <Routes>
          <Route path="/rosters/:id" element={<RosterDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

  it('publishes the roster', async () => {
    (api.rosters.get as any).mockResolvedValue(baseRoster);
    (api.groups.listMembers as any).mockResolvedValue([]);
    (api.rosters.publish as any).mockResolvedValue({ id: 'roster-1', status: 'published' });

    renderPage();

    await waitFor(() => expect(screen.getByText(/Morning/)).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(api.rosters.publish).toHaveBeenCalledWith('roster-1'));
    await waitFor(() => expect(screen.getByText('Published')).toBeInTheDocument());
  });

  it('sends emails to everyone assigned', async () => {
    (api.rosters.get as any).mockResolvedValue(baseRoster);
    (api.groups.listMembers as any).mockResolvedValue([]);
    (api.rosters.sendEmails as any).mockResolvedValue({ sentTo: ['a@b.com'] });

    renderPage();

    await waitFor(() => expect(screen.getByText(/Morning/)).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Email Everyone' }));

    await waitFor(() => expect(api.rosters.sendEmails).toHaveBeenCalledWith('roster-1'));
    await waitFor(() => expect(screen.getByText(/Sent to 1 staff/)).toBeInTheDocument());
  });
});
