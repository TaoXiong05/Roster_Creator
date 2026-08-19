import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RosterCreatePage } from '../RosterCreatePage';
import { api } from '../../api/client';

vi.mock('../../api/client', () => ({
  api: {
    shiftTemplates: { list: vi.fn() },
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
      requiredSkills: [],
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

  it('prefills the form from the existing roster and saves via update', async () => {
    (api.shiftTemplates.list as any).mockResolvedValue([
      { id: 'template-1', name: 'Morning', startTime: '06:00', endTime: '14:00' },
    ]);
    (api.groups.list as any).mockResolvedValue([{ id: 'group-1', name: 'Kitchen', memberCount: 2 }]);
    (api.rosters.get as any).mockResolvedValue(existingRoster);
    (api.rosters.update as any).mockResolvedValue({ id: 'roster-1' });

    renderEdit();

    await waitFor(() => expect(screen.getByDisplayValue('Week 34')).toBeInTheDocument());
    expect(screen.getByLabelText('开始日期')).toHaveValue('2026-08-17');
    expect(screen.getByLabelText('结束日期')).toHaveValue('2026-08-18');
    expect(screen.getByLabelText('员工小组')).toHaveValue('group-1');
    expect(screen.getByRole('heading', { name: '编辑排班' })).toBeInTheDocument();

    // Existing shift day is shown in the calendar.
    expect(screen.getByRole('button', { name: /08-17/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '保存修改' }));

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
            expect.objectContaining({ shiftTemplateId: 'template-1', dates: ['2026-08-17'], headcount: 3 }),
          ]),
        })
      )
    );
  });

  it('shows an error when loading the roster fails', async () => {
    (api.rosters.get as any).mockRejectedValue(new Error('Roster not found'));

    renderEdit();

    expect(await screen.findByRole('alert')).toHaveTextContent('Roster not found');
    expect(api.rosters.update).not.toHaveBeenCalled();
  });
});
