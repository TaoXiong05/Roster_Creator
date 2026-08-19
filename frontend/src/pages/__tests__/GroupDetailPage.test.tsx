import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { GroupDetailPage } from '../GroupDetailPage';
import { api } from '../../api/client';

vi.mock('../../api/client', () => ({
  api: {
    groups: { listMembers: vi.fn(), addMember: vi.fn(), removeMember: vi.fn() },
    staff: { list: vi.fn(), updatePreference: vi.fn() },
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

    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(api.groups.addMember).toHaveBeenCalledWith('group-1', 'staff-2'));
  });

  it("shows a member's unavailable dates directly on their row", async () => {
    (api.groups.listMembers as any).mockResolvedValue([
      {
        id: 'staff-1',
        name: 'Alice',
        preference: {
          preferredShifts: [],
          unavailableShifts: [],
          unavailableDateRanges: [
            { start: '2026-08-01', end: '2026-08-03' },
            { start: '2026-09-10', end: '2026-09-12' },
          ],
          minHours: 0,
          maxHours: 40,
          hoursPeriod: 'weekly',
          hoursUnit: 'hours',
        },
      },
      { id: 'staff-2', name: 'Bob', preference: null },
    ]);
    (api.staff.list as any).mockResolvedValue([
      { id: 'staff-1', name: 'Alice' },
      { id: 'staff-2', name: 'Bob' },
    ]);

    render(
      <MemoryRouter initialEntries={['/groups/group-1']}>
        <Routes>
          <Route path="/groups/:id" element={<GroupDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    expect(screen.getByText('Unavailable: 01/08/2026~03/08/2026, 10/09/2026~12/09/2026')).toBeInTheDocument();

    const bobRow = screen.getByText('Bob').closest('tr')!;
    expect(bobRow).not.toHaveTextContent('Unavailable:');
  });

  it("sets a member's unavailable dates through the calendar dialog", async () => {
    (api.groups.listMembers as any).mockResolvedValue([
      {
        id: 'staff-1',
        name: 'Alice',
        preference: {
          preferredShifts: [],
          unavailableShifts: [],
          unavailableDateRanges: [{ start: '2026-08-01', end: '2026-08-03' }],
          minHours: 0,
          maxHours: 40,
          hoursPeriod: 'weekly',
          hoursUnit: 'hours',
        },
      },
    ]);
    (api.staff.list as any).mockResolvedValue([{ id: 'staff-1', name: 'Alice' }]);
    (api.staff.updatePreference as any).mockResolvedValue({
      preferredShifts: [],
      unavailableShifts: [],
      unavailableDateRanges: [
        { start: '2026-08-01', end: '2026-08-03' },
        { start: '2026-09-10', end: '2026-09-12' },
      ],
      minHours: 0,
      maxHours: 40,
      hoursPeriod: 'weekly',
      hoursUnit: 'hours',
    });

    render(
      <MemoryRouter initialEntries={['/groups/group-1']}>
        <Routes>
          <Route path="/groups/:id" element={<GroupDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Set Unavailable Dates' }));

    expect(await screen.findByText('01/08/2026 ~ 03/08/2026')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: '2026-09-10' } });
    fireEvent.change(screen.getByLabelText('End Date'), { target: { value: '2026-09-12' } });
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByText('10/09/2026 ~ 12/09/2026')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(api.staff.updatePreference).toHaveBeenCalledWith(
        'staff-1',
        expect.objectContaining({
          unavailableDateRanges: [
            { start: '2026-08-01', end: '2026-08-03' },
            { start: '2026-09-10', end: '2026-09-12' },
          ],
        })
      )
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
