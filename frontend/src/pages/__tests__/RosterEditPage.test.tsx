import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RosterCreatePage } from '../RosterCreatePage';
import { api } from '../../api/client';

vi.mock('../../api/client', () => ({
  api: {
    shiftTemplates: { list: vi.fn() },
    responsibilities: { list: vi.fn() },
    groups: { list: vi.fn() },
    rosters: { get: vi.fn(), update: vi.fn() },
  },
}));

const existingRoster = {
  id: 'roster-1',
  name: 'Week 34',
  dateRangeStart: '2026-08-17T00:00:00.000Z',
  dateRangeEnd: '2026-08-18T00:00:00.000Z',
  groupId: 'group-1',
  status: 'draft',
  hoursPerShift: 8,
  rosterShifts: [
    {
      id: 'rs-1',
      date: '2026-08-17T00:00:00.000Z',
      headcount: 3,
      responsibilityId: 'resp-1',
      shiftTemplate: { id: 'template-1', name: 'Morning', startTime: '06:00', endTime: '14:00' },
      assignments: [],
    },
  ],
};

function renderEdit() {
  return render(
    <MemoryRouter initialEntries={['/rosters/roster-1/edit']}>
      <Routes>
        <Route path="/rosters/new" element={<RosterCreatePage />} />
        <Route path="/rosters/:id/edit" element={<RosterCreatePage />} />
        <Route path="/rosters/:id" element={<div>roster detail</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('RosterCreatePage (edit mode)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows a loading skeleton while the roster fetch is in flight, then replaces it with the populated form', async () => {
    (api.shiftTemplates.list as any).mockResolvedValue([
      { id: 'template-1', name: 'Morning', startTime: '06:00', endTime: '14:00' },
    ]);
    (api.responsibilities.list as any).mockResolvedValue([{ id: 'resp-1', name: 'Cashier' }]);
    (api.groups.list as any).mockResolvedValue([{ id: 'group-1', name: 'Kitchen', memberCount: 2 }]);
    let resolveGet: (roster: typeof existingRoster) => void;
    (api.rosters.get as any).mockReturnValue(
      new Promise((resolve) => {
        resolveGet = resolve;
      })
    );

    renderEdit();

    // While the fetch is pending: skeleton is shown, and the real form (including a field a
    // user could type into) is not in the document yet, so nothing can be silently overwritten.
    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Roster name')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument();

    resolveGet!(existingRoster);

    // Once the fetch resolves: skeleton is gone, form is present and populated.
    await waitFor(() => expect(screen.getByDisplayValue('Week 34')).toBeInTheDocument());
    expect(screen.queryByLabelText('Loading')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
  });

  it('prefills the form from the existing roster and saves via update', async () => {
    (api.shiftTemplates.list as any).mockResolvedValue([
      { id: 'template-1', name: 'Morning', startTime: '06:00', endTime: '14:00' },
    ]);
    (api.responsibilities.list as any).mockResolvedValue([{ id: 'resp-1', name: 'Cashier' }]);
    (api.groups.list as any).mockResolvedValue([{ id: 'group-1', name: 'Kitchen', memberCount: 2 }]);
    (api.rosters.get as any).mockResolvedValue(existingRoster);
    (api.rosters.update as any).mockResolvedValue({ id: 'roster-1' });

    renderEdit();

    await waitFor(() => expect(screen.getByDisplayValue('Week 34')).toBeInTheDocument());
    expect(screen.getByLabelText('Start Date')).toHaveValue('2026-08-17');
    expect(screen.getByLabelText('End Date')).toHaveValue('2026-08-18');
    expect(screen.getByLabelText('Staff Group')).toHaveValue('group-1');
    expect(screen.getByRole('heading', { name: 'Edit Roster' })).toBeInTheDocument();

    // Existing shift day is shown in the calendar. (Query excludes the day's "copy" icon
    // button, which also has an accessible name containing the date.)
    expect(
      screen.getByRole('button', { name: (name) => name.includes('17/08/2026') && !name.startsWith('Copy') })
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() =>
      expect(api.rosters.update).toHaveBeenCalledWith(
        'roster-1',
        expect.objectContaining({
          name: 'Week 34',
          dateRangeStart: '2026-08-17',
          dateRangeEnd: '2026-08-18',
          groupId: 'group-1',
          hoursPerShift: 8,
          shifts: expect.arrayContaining([
            expect.objectContaining({
              shiftTemplateId: 'template-1',
              dates: ['2026-08-17'],
              requirements: [{ responsibilityId: 'resp-1', headcount: 3 }],
            }),
          ]),
        })
      )
    );
  });

  it('shows an error when loading the roster fails, clearing the loading skeleton rather than hanging on it', async () => {
    (api.rosters.get as any).mockRejectedValue(new Error('Roster not found'));

    renderEdit();

    expect(screen.getByLabelText('Loading')).toBeInTheDocument();

    expect(await screen.findByRole('alert')).toHaveTextContent('Roster not found');
    expect(screen.queryByLabelText('Loading')).not.toBeInTheDocument();
    expect(api.rosters.update).not.toHaveBeenCalled();
  });
});
