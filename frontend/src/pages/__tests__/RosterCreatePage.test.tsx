import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { RosterCreatePage } from '../RosterCreatePage';
import { api } from '../../api/client';

vi.mock('../../api/client', () => ({
  api: {
    shiftTemplates: { list: vi.fn() },
    responsibilities: { list: vi.fn() },
    groups: { list: vi.fn() },
    rosters: { create: vi.fn() },
  },
}));

describe('RosterCreatePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.responsibilities.list as any).mockResolvedValue([
      { id: 'resp-1', name: 'Cashier' },
      { id: 'resp-2', name: 'Cleaning' },
    ]);
  });

  it('creates a roster by setting shifts, responsibility and headcount through the per-day dialog, with a custom hoursPerShift', async () => {
    (api.shiftTemplates.list as any).mockResolvedValue([
      { id: 'template-1', name: 'Morning', startTime: '06:00', endTime: '14:00' },
      { id: 'template-2', name: 'Evening', startTime: '14:00', endTime: '22:00' },
    ]);
    (api.groups.list as any).mockResolvedValue([{ id: 'group-1', name: 'Kitchen', memberCount: 2 }]);
    (api.rosters.create as any).mockResolvedValue({ id: 'roster-1' });

    render(
      <MemoryRouter>
        <RosterCreatePage />
      </MemoryRouter>
    );

    await waitFor(() => expect(api.shiftTemplates.list).toHaveBeenCalled());

    await userEvent.type(screen.getByPlaceholderText('Roster name'), 'Week 34');
    fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: '2026-08-17' } });
    fireEvent.change(screen.getByLabelText('End Date'), { target: { value: '2026-08-18' } });
    await userEvent.selectOptions(screen.getByLabelText('Staff Group'), 'group-1');

    const hoursPerShift = screen.getByLabelText('Hours per shift');
    await userEvent.clear(hoursPerShift);
    await userEvent.type(hoursPerShift, '6');

    // Day 1: open the dialog, add Morning, choose a responsibility, set headcount to 3, close.
    await userEvent.click(screen.getByRole('button', { name: /17\/08\/2026/ }));
    await userEvent.click(await screen.findByRole('button', { name: '+ Morning' }));
    await userEvent.selectOptions(screen.getByLabelText('Morning role 1'), 'resp-1');
    const morningHeadcount = screen.getByLabelText('Morning Cashier headcount');
    await userEvent.clear(morningHeadcount);
    await userEvent.type(morningHeadcount, '3');
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));

    // Day 2: same flow with Evening, a different responsibility, headcount 4.
    await userEvent.click(screen.getByRole('button', { name: /18\/08\/2026/ }));
    await userEvent.click(await screen.findByRole('button', { name: '+ Evening' }));
    await userEvent.selectOptions(screen.getByLabelText('Evening role 1'), 'resp-2');
    const eveningHeadcount = screen.getByLabelText('Evening Cleaning headcount');
    await userEvent.clear(eveningHeadcount);
    await userEvent.type(eveningHeadcount, '4');
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));

    await userEvent.click(screen.getByRole('button', { name: 'Create Roster' }));

    await waitFor(() =>
      expect(api.rosters.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Week 34',
          dateRangeStart: '2026-08-17',
          dateRangeEnd: '2026-08-18',
          groupId: 'group-1',
          hoursPerShift: 6,
          shifts: expect.arrayContaining([
            expect.objectContaining({
              shiftTemplateId: 'template-1',
              dates: ['2026-08-17'],
              requirements: [{ responsibilityId: 'resp-1', headcount: 3 }],
            }),
            expect.objectContaining({
              shiftTemplateId: 'template-2',
              dates: ['2026-08-18'],
              requirements: [{ responsibilityId: 'resp-2', headcount: 4 }],
            }),
          ]),
        })
      )
    );
  });

  it('adds a second responsibility requirement to the same shift via "添加更多"', async () => {
    (api.shiftTemplates.list as any).mockResolvedValue([
      { id: 'template-1', name: 'Morning', startTime: '06:00', endTime: '14:00' },
    ]);
    (api.groups.list as any).mockResolvedValue([{ id: 'group-1', name: 'Kitchen', memberCount: 2 }]);
    (api.rosters.create as any).mockResolvedValue({ id: 'roster-1' });

    render(
      <MemoryRouter>
        <RosterCreatePage />
      </MemoryRouter>
    );

    await waitFor(() => expect(api.shiftTemplates.list).toHaveBeenCalled());
    await userEvent.type(screen.getByPlaceholderText('Roster name'), 'Week 34');
    fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: '2026-08-17' } });
    fireEvent.change(screen.getByLabelText('End Date'), { target: { value: '2026-08-17' } });
    await userEvent.selectOptions(screen.getByLabelText('Staff Group'), 'group-1');

    await userEvent.click(screen.getByRole('button', { name: /17\/08\/2026/ }));
    await userEvent.click(await screen.findByRole('button', { name: '+ Morning' }));
    await userEvent.selectOptions(screen.getByLabelText('Morning role 1'), 'resp-1');
    const firstHeadcount = screen.getByLabelText('Morning Cashier headcount');
    await userEvent.clear(firstHeadcount);
    await userEvent.type(firstHeadcount, '2');

    await userEvent.click(screen.getByRole('button', { name: '+ Add another requirement' }));
    await userEvent.selectOptions(screen.getByLabelText('Morning role 2'), 'resp-2');
    const secondHeadcount = screen.getByLabelText('Morning Cleaning headcount');
    await userEvent.clear(secondHeadcount);
    await userEvent.type(secondHeadcount, '1');

    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    await userEvent.click(screen.getByRole('button', { name: 'Create Roster' }));

    await waitFor(() =>
      expect(api.rosters.create).toHaveBeenCalledWith(
        expect.objectContaining({
          shifts: [
            expect.objectContaining({
              shiftTemplateId: 'template-1',
              dates: ['2026-08-17'],
              requirements: [
                { responsibilityId: 'resp-1', headcount: 2 },
                { responsibilityId: 'resp-2', headcount: 1 },
              ],
            }),
          ],
        })
      )
    );
  });

  it('blocks submission with a clear message when a headcount is set but no responsibility is chosen', async () => {
    (api.shiftTemplates.list as any).mockResolvedValue([
      { id: 'template-1', name: 'Morning', startTime: '06:00', endTime: '14:00' },
    ]);
    (api.groups.list as any).mockResolvedValue([{ id: 'group-1', name: 'Kitchen', memberCount: 2 }]);

    render(
      <MemoryRouter>
        <RosterCreatePage />
      </MemoryRouter>
    );

    await waitFor(() => expect(api.shiftTemplates.list).toHaveBeenCalled());
    await userEvent.type(screen.getByPlaceholderText('Roster name'), 'Week 34');
    fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: '2026-08-17' } });
    fireEvent.change(screen.getByLabelText('End Date'), { target: { value: '2026-08-17' } });
    await userEvent.selectOptions(screen.getByLabelText('Staff Group'), 'group-1');

    await userEvent.click(screen.getByRole('button', { name: /17\/08\/2026/ }));
    await userEvent.click(await screen.findByRole('button', { name: '+ Morning' }));
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));

    await userEvent.click(screen.getByRole('button', { name: 'Create Roster' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Please choose a role for every headcount requirement');
    expect(api.rosters.create).not.toHaveBeenCalled();
  });

  it('blocks submission with a clear message when no shifts are set', async () => {
    (api.shiftTemplates.list as any).mockResolvedValue([
      { id: 'template-1', name: 'Morning', startTime: '06:00', endTime: '14:00' },
    ]);
    (api.groups.list as any).mockResolvedValue([{ id: 'group-1', name: 'Kitchen', memberCount: 2 }]);

    render(
      <MemoryRouter>
        <RosterCreatePage />
      </MemoryRouter>
    );

    await waitFor(() => expect(api.shiftTemplates.list).toHaveBeenCalled());

    await userEvent.type(screen.getByPlaceholderText('Roster name'), 'Week 34');
    fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: '2026-08-17' } });
    fireEvent.change(screen.getByLabelText('End Date'), { target: { value: '2026-08-18' } });
    await userEvent.selectOptions(screen.getByLabelText('Staff Group'), 'group-1');

    await userEvent.click(screen.getByRole('button', { name: 'Create Roster' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("You need to set at least one shift’s headcount on at least one day");
    expect(api.rosters.create).not.toHaveBeenCalled();
  });

  it('removing a shift from a day drops it from submission', async () => {
    (api.shiftTemplates.list as any).mockResolvedValue([
      { id: 'template-1', name: 'Morning', startTime: '06:00', endTime: '14:00' },
    ]);
    (api.groups.list as any).mockResolvedValue([{ id: 'group-1', name: 'Kitchen', memberCount: 2 }]);

    render(
      <MemoryRouter>
        <RosterCreatePage />
      </MemoryRouter>
    );

    await waitFor(() => expect(api.shiftTemplates.list).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: '2026-08-17' } });
    fireEvent.change(screen.getByLabelText('End Date'), { target: { value: '2026-08-17' } });

    await userEvent.click(screen.getByRole('button', { name: /17\/08\/2026/ }));
    await userEvent.click(await screen.findByRole('button', { name: '+ Morning' }));
    expect(screen.getByLabelText('Morning role headcount')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Remove Morning' }));
    expect(screen.queryByLabelText('Morning role headcount')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Morning' })).toBeInTheDocument();
  });

  it('paginates the calendar 7 days at a time', async () => {
    (api.shiftTemplates.list as any).mockResolvedValue([
      { id: 'template-1', name: 'Morning', startTime: '06:00', endTime: '14:00' },
    ]);
    (api.groups.list as any).mockResolvedValue([{ id: 'group-1', name: 'Kitchen', memberCount: 2 }]);

    render(
      <MemoryRouter>
        <RosterCreatePage />
      </MemoryRouter>
    );

    await waitFor(() => expect(api.shiftTemplates.list).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: '2026-08-01' } });
    fireEvent.change(screen.getByLabelText('End Date'), { target: { value: '2026-08-10' } });

    expect(screen.getByRole('button', { name: /01\/08\/2026/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /08\/08\/2026/ })).not.toBeInTheDocument();
    expect(screen.getByText('Page 1 / 2')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Next Week →' }));

    expect(screen.queryByRole('button', { name: /01\/08\/2026/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /08\/08\/2026/ })).toBeInTheDocument();
    expect(screen.getByText('Page 2 / 2')).toBeInTheDocument();
  });
});
