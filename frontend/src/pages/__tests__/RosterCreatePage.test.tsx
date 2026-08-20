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

  it('never shows the loading skeleton on the create path, since there is no existing roster to fetch', async () => {
    (api.shiftTemplates.list as any).mockResolvedValue([]);
    (api.groups.list as any).mockResolvedValue([]);

    render(
      <MemoryRouter>
        <RosterCreatePage />
      </MemoryRouter>
    );

    // The create form (no `id` param, so isEdit is false) renders immediately — no fetch is
    // in flight for it to wait on, so the skeleton placeholder must never appear.
    expect(screen.queryByLabelText('Loading')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Roster name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Roster' })).toBeInTheDocument();

    await waitFor(() => expect(api.shiftTemplates.list).toHaveBeenCalled());
    expect(screen.queryByLabelText('Loading')).not.toBeInTheDocument();
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

    await userEvent.click(screen.getByRole('button', { name: 'Next →' }));

    expect(screen.queryByRole('button', { name: /01\/08\/2026/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /08\/08\/2026/ })).toBeInTheDocument();
    expect(screen.getByText('Page 2 / 2')).toBeInTheDocument();
  });

  it('switches to a 14-day fortnightly grid and resets pagination to page 1', async () => {
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
    fireEvent.change(screen.getByLabelText('End Date'), { target: { value: '2026-08-21' } });

    // Weekly view: 7 days per page, 3 pages for a 21-day range.
    expect(screen.getByText('Page 1 / 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /01\/08\/2026/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /08\/08\/2026/ })).not.toBeInTheDocument();

    // Move to page 2 before switching views, to verify the toggle resets pagination.
    await userEvent.click(screen.getByRole('button', { name: 'Next →' }));
    expect(screen.getByText('Page 2 / 3')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Fortnightly' }));

    // Switching view resets to page 1, now showing 14 days (2 pages for a 21-day range).
    expect(screen.getByText('Page 1 / 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /01\/08\/2026/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /08\/08\/2026/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /14\/08\/2026/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /15\/08\/2026/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Next →' }));
    expect(screen.getByText('Page 2 / 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /15\/08\/2026/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /21\/08\/2026/ })).toBeInTheDocument();

    // Switching back to weekly also resets to page 1 and shrinks the page size back to 7 days.
    await userEvent.click(screen.getByRole('button', { name: 'Weekly' }));
    expect(screen.getByText('Page 1 / 3')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /08\/08\/2026/ })).not.toBeInTheDocument();
  });

  it('highlights today\'s date cell', async () => {
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
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const [, month, day] = today.split('-');
    fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: today } });
    fireEvent.change(screen.getByLabelText('End Date'), { target: { value: today } });

    const todayButton = screen.getByRole('button', { name: new RegExp(`${day}/${month}/`) });
    expect(todayButton.className).toContain('border-coral-deep/50');
  });
});

// Queries the big day-cell button for a given formatted date (e.g. "17/08/2026"), excluding
// the small "copy" icon button that also carries the date in its accessible name once the day
// has shifts set.
function dayCellButton(dateText: string) {
  return screen.getByRole('button', {
    name: (name) => name.includes(dateText) && !name.startsWith('Copy'),
  });
}

describe('RosterCreatePage copy/paste day shifts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.responsibilities.list as any).mockResolvedValue([
      { id: 'resp-1', name: 'Cashier' },
      { id: 'resp-2', name: 'Cleaning' },
    ]);
    (api.shiftTemplates.list as any).mockResolvedValue([
      { id: 'template-1', name: 'Morning', startTime: '06:00', endTime: '14:00' },
    ]);
    (api.groups.list as any).mockResolvedValue([{ id: 'group-1', name: 'Kitchen', memberCount: 2 }]);
    (api.rosters.create as any).mockResolvedValue({ id: 'roster-1' });
  });

  async function setUpBasicForm(start: string, end: string) {
    render(
      <MemoryRouter>
        <RosterCreatePage />
      </MemoryRouter>
    );
    await waitFor(() => expect(api.shiftTemplates.list).toHaveBeenCalled());
    await userEvent.type(screen.getByPlaceholderText('Roster name'), 'Week 34');
    fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: start } });
    fireEvent.change(screen.getByLabelText('End Date'), { target: { value: end } });
    await userEvent.selectOptions(screen.getByLabelText('Staff Group'), 'group-1');
  }

  async function setDayShift(dateText: string, responsibilityLabel: string, headcount: string) {
    await userEvent.click(dayCellButton(dateText));
    const addButton = screen.queryByRole('button', { name: '+ Morning' });
    if (addButton) {
      await userEvent.click(addButton);
    }
    await userEvent.selectOptions(screen.getByLabelText('Morning role 1'), responsibilityLabel);
    const respName = responsibilityLabel === 'resp-1' ? 'Cashier' : 'Cleaning';
    const headcountField = screen.getByLabelText(`Morning ${respName} headcount`);
    await userEvent.clear(headcountField);
    await userEvent.type(headcountField, headcount);
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
  }

  it('copies a day\'s shifts and pastes them onto other selected days', async () => {
    await setUpBasicForm('2026-08-17', '2026-08-19');

    // Set up shifts on day 1 (Mon 17/08).
    await setDayShift('17/08/2026', 'resp-1', '3');

    // Copy day 1's settings.
    await userEvent.click(screen.getByRole('button', { name: "Copy 17/08/2026's shift settings" }));

    // Banner shows the copied date and a live selected count.
    expect(screen.getByText(/Copied 17\/08\/2026/)).toBeInTheDocument();
    expect(screen.getByText('0 selected')).toBeInTheDocument();

    // The source day's button becomes disabled and shows a "Copied" badge instead of a checkbox.
    const sourceButton = dayCellButton('17/08/2026');
    expect(sourceButton).toBeDisabled();
    expect(screen.getByText('Copied')).toBeInTheDocument();
    expect(screen.queryByLabelText('Select 17/08/2026 as a paste target')).not.toBeInTheDocument();

    // Clicking another day cell toggles it as a paste target instead of opening the edit dialog.
    await userEvent.click(dayCellButton('18/08/2026'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('1 selected')).toBeInTheDocument();

    await userEvent.click(dayCellButton('19/08/2026'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('2 selected')).toBeInTheDocument();

    // Toggle 19 back off, then re-select it via its checkbox to confirm both entry points work.
    await userEvent.click(dayCellButton('19/08/2026'));
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Select 19/08/2026 as a paste target'));
    expect(screen.getByText('2 selected')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Paste' }));

    // Paste mode exits after confirming.
    expect(screen.queryByText(/Copied 17\/08\/2026/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Create Roster' }));

    await waitFor(() =>
      expect(api.rosters.create).toHaveBeenCalledWith(
        expect.objectContaining({
          shifts: expect.arrayContaining([
            expect.objectContaining({
              shiftTemplateId: 'template-1',
              dates: ['2026-08-17'],
              requirements: [{ responsibilityId: 'resp-1', headcount: 3 }],
            }),
            expect.objectContaining({
              shiftTemplateId: 'template-1',
              dates: ['2026-08-18'],
              requirements: [{ responsibilityId: 'resp-1', headcount: 3 }],
            }),
            expect.objectContaining({
              shiftTemplateId: 'template-1',
              dates: ['2026-08-19'],
              requirements: [{ responsibilityId: 'resp-1', headcount: 3 }],
            }),
          ]),
        })
      )
    );
  });

  it('Cancel exits paste mode without copying anything', async () => {
    await setUpBasicForm('2026-08-17', '2026-08-18');
    await setDayShift('17/08/2026', 'resp-1', '3');

    await userEvent.click(screen.getByRole('button', { name: "Copy 17/08/2026's shift settings" }));
    await userEvent.click(dayCellButton('18/08/2026'));
    expect(screen.getByText('1 selected')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    // Banner is gone and day cells go back to opening the edit dialog on click.
    expect(screen.queryByText(/Copied 17\/08\/2026/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /18\/08\/2026/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));

    await userEvent.click(screen.getByRole('button', { name: 'Create Roster' }));

    await waitFor(() =>
      expect(api.rosters.create).toHaveBeenCalledWith(
        expect.objectContaining({
          shifts: [
            expect.objectContaining({
              shiftTemplateId: 'template-1',
              dates: ['2026-08-17'],
              requirements: [{ responsibilityId: 'resp-1', headcount: 3 }],
            }),
          ],
        })
      )
    );
  });

  it('pasting onto a day that already has different shifts overwrites rather than merges them', async () => {
    await setUpBasicForm('2026-08-17', '2026-08-18');
    await setDayShift('17/08/2026', 'resp-1', '3');
    await setDayShift('18/08/2026', 'resp-2', '2');

    await userEvent.click(screen.getByRole('button', { name: "Copy 17/08/2026's shift settings" }));
    await userEvent.click(dayCellButton('18/08/2026'));
    await userEvent.click(screen.getByRole('button', { name: 'Paste' }));

    await userEvent.click(screen.getByRole('button', { name: 'Create Roster' }));

    await waitFor(() =>
      expect(api.rosters.create).toHaveBeenCalledWith(
        expect.objectContaining({
          shifts: [
            expect.objectContaining({
              shiftTemplateId: 'template-1',
              dates: ['2026-08-17'],
              requirements: [{ responsibilityId: 'resp-1', headcount: 3 }],
            }),
            expect.objectContaining({
              shiftTemplateId: 'template-1',
              dates: ['2026-08-18'],
              requirements: [{ responsibilityId: 'resp-1', headcount: 3 }],
            }),
          ],
        })
      )
    );
  });

  it('keeps paste target selection across pages when paging forward', async () => {
    await setUpBasicForm('2026-08-01', '2026-08-10');
    await setDayShift('01/08/2026', 'resp-1', '3');

    await userEvent.click(screen.getByRole('button', { name: "Copy 01/08/2026's shift settings" }));
    await userEvent.click(dayCellButton('03/08/2026'));
    expect(screen.getByText('1 selected')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Next →' }));
    expect(screen.getByText('Page 2 / 2')).toBeInTheDocument();
    // Selection made on page 1 is preserved after paging forward.
    expect(screen.getByText('1 selected')).toBeInTheDocument();

    await userEvent.click(dayCellButton('08/08/2026'));
    expect(screen.getByText('2 selected')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Paste' }));
    await userEvent.click(screen.getByRole('button', { name: 'Create Roster' }));

    await waitFor(() =>
      expect(api.rosters.create).toHaveBeenCalledWith(
        expect.objectContaining({
          shifts: expect.arrayContaining([
            expect.objectContaining({ dates: ['2026-08-01'], requirements: [{ responsibilityId: 'resp-1', headcount: 3 }] }),
            expect.objectContaining({ dates: ['2026-08-03'], requirements: [{ responsibilityId: 'resp-1', headcount: 3 }] }),
            expect.objectContaining({ dates: ['2026-08-08'], requirements: [{ responsibilityId: 'resp-1', headcount: 3 }] }),
          ]),
        })
      )
    );
  });

  it('deep clones pasted rows so editing one pasted day does not affect another', async () => {
    await setUpBasicForm('2026-08-17', '2026-08-19');
    await setDayShift('17/08/2026', 'resp-1', '3');

    await userEvent.click(screen.getByRole('button', { name: "Copy 17/08/2026's shift settings" }));
    await userEvent.click(dayCellButton('18/08/2026'));
    await userEvent.click(dayCellButton('19/08/2026'));
    await userEvent.click(screen.getByRole('button', { name: 'Paste' }));

    // Edit the pasted day 18's headcount up to 9.
    await userEvent.click(dayCellButton('18/08/2026'));
    const headcountField = screen.getByLabelText('Morning Cashier headcount');
    await userEvent.clear(headcountField);
    await userEvent.type(headcountField, '9');
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));

    await userEvent.click(screen.getByRole('button', { name: 'Create Roster' }));

    await waitFor(() =>
      expect(api.rosters.create).toHaveBeenCalledWith(
        expect.objectContaining({
          shifts: expect.arrayContaining([
            expect.objectContaining({ dates: ['2026-08-17'], requirements: [{ responsibilityId: 'resp-1', headcount: 3 }] }),
            expect.objectContaining({ dates: ['2026-08-18'], requirements: [{ responsibilityId: 'resp-1', headcount: 9 }] }),
            expect.objectContaining({ dates: ['2026-08-19'], requirements: [{ responsibilityId: 'resp-1', headcount: 3 }] }),
          ]),
        })
      )
    );
  });
});

describe('RosterCreatePage monthly view', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.responsibilities.list as any).mockResolvedValue([
      { id: 'resp-1', name: 'Cashier' },
      { id: 'resp-2', name: 'Cleaning' },
    ]);
    (api.shiftTemplates.list as any).mockResolvedValue([
      { id: 'template-1', name: 'Morning', startTime: '06:00', endTime: '14:00' },
    ]);
    (api.groups.list as any).mockResolvedValue([{ id: 'group-1', name: 'Kitchen', memberCount: 2 }]);
  });

  it('renders a full Sun-Sat calendar-month grid with a weekday header, dimming adjacent-month padding days as non-interactive placeholders', async () => {
    const { container } = render(
      <MemoryRouter>
        <RosterCreatePage />
      </MemoryRouter>
    );

    await waitFor(() => expect(api.shiftTemplates.list).toHaveBeenCalled());
    // A full month, starting on the 1st: August 1 2026 is a Saturday and August 31 is a Monday,
    // so the Sun-Sat grid needs 6 leading days (Jul 26-31) and 5 trailing days (Sep 1-5) — 42 cells total.
    fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: '2026-08-01' } });
    fireEvent.change(screen.getByLabelText('End Date'), { target: { value: '2026-08-31' } });

    // The weekday header row is absent in the default (weekly) view.
    expect(screen.getAllByText('Sun').every((el) => el.tagName !== 'SPAN')).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: 'Monthly' }));

    // Weekday header row appears only in monthly mode, rendered as <span> elements.
    expect(screen.getAllByText('Sun').some((el) => el.tagName === 'SPAN')).toBe(true);
    expect(screen.getAllByText('Sat').some((el) => el.tagName === 'SPAN')).toBe(true);

    // Page indicator shows the month name, not "Page X / Y".
    expect(screen.getByText('August 2026')).toBeInTheDocument();
    expect(screen.queryByText(/^Page \d/)).not.toBeInTheDocument();

    // In-range days render as real, clickable buttons.
    expect(screen.getByRole('button', { name: /01\/08\/2026/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /31\/08\/2026/ })).toBeInTheDocument();

    // Leading (Jul 26-31) and trailing (Sep 1-5) padding days from adjacent months are dimmed
    // placeholders — not buttons, not clickable, no copy icon.
    expect(screen.queryByRole('button', { name: /26\/07\/2026/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /01\/09\/2026/ })).not.toBeInTheDocument();
    const placeholders = container.querySelectorAll('[aria-hidden="true"].border-dashed');
    expect(placeholders.length).toBe(11); // 6 leading + 5 trailing
    for (const placeholder of placeholders) {
      expect(placeholder.tagName).toBe('DIV');
      expect(placeholder.querySelector('button')).toBeNull();
    }
  });

  it('excludes in-month days outside the selected range (e.g. before a start date not on the 1st) the same way as adjacent-month padding', async () => {
    const { container } = render(
      <MemoryRouter>
        <RosterCreatePage />
      </MemoryRouter>
    );

    await waitFor(() => expect(api.shiftTemplates.list).toHaveBeenCalled());
    // Range starts mid-month, so Aug 1-16 sit inside the August grid but outside the range,
    // alongside the true leading (Jul 26-31) and trailing (Sep 1-5) padding days.
    fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: '2026-08-17' } });
    fireEvent.change(screen.getByLabelText('End Date'), { target: { value: '2026-08-31' } });

    await userEvent.click(screen.getByRole('button', { name: 'Monthly' }));

    expect(screen.getByRole('button', { name: /17\/08\/2026/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /16\/08\/2026/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /01\/08\/2026/ })).not.toBeInTheDocument();

    // 6 leading + 16 in-month-before-start (Aug 1-16) + 5 trailing = 27 dimmed placeholders.
    const placeholders = container.querySelectorAll('[aria-hidden="true"].border-dashed');
    expect(placeholders.length).toBe(27);

    // Clicking a dimmed placeholder does nothing — no dialog opens.
    fireEvent.click(placeholders[0]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the month name as the page indicator and steps Prev/Next by calendar month', async () => {
    render(
      <MemoryRouter>
        <RosterCreatePage />
      </MemoryRouter>
    );

    await waitFor(() => expect(api.shiftTemplates.list).toHaveBeenCalled());
    // Spans two calendar months: August and September 2026. September's grid only borrows Aug
    // 30-31 as leading padding, so Aug 20 is exclusive to August's page and Sep 20 to September's.
    fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: '2026-08-17' } });
    fireEvent.change(screen.getByLabelText('End Date'), { target: { value: '2026-09-20' } });

    await userEvent.click(screen.getByRole('button', { name: 'Monthly' }));

    expect(screen.getByText('August 2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /17\/08\/2026/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /20\/08\/2026/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /20\/09\/2026/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Next →' }));

    expect(screen.getByText('September 2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /20\/09\/2026/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /20\/08\/2026/ })).not.toBeInTheDocument();
    // Only 2 months in range, so Next is now disabled.
    expect(screen.getByRole('button', { name: 'Next →' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: '← Previous' }));
    expect(screen.getByText('August 2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /20\/08\/2026/ })).toBeInTheDocument();
  });

  it('resets pagination to page 1 when switching into or out of monthly view', async () => {
    render(
      <MemoryRouter>
        <RosterCreatePage />
      </MemoryRouter>
    );

    await waitFor(() => expect(api.shiftTemplates.list).toHaveBeenCalled());
    // 20-day range spanning two months: 3 weekly pages, 2 fortnightly pages, 2 monthly pages.
    fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: '2026-08-17' } });
    fireEvent.change(screen.getByLabelText('End Date'), { target: { value: '2026-09-05' } });

    expect(screen.getByText('Page 1 / 3')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next →' }));
    expect(screen.getByText('Page 2 / 3')).toBeInTheDocument();

    // Switching into monthly resets to page 1 (shown as the first month's name).
    await userEvent.click(screen.getByRole('button', { name: 'Monthly' }));
    expect(screen.getByText('August 2026')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Next →' }));
    expect(screen.getByText('September 2026')).toBeInTheDocument();

    // Switching out of monthly (to fortnightly) also resets to page 1.
    await userEvent.click(screen.getByRole('button', { name: 'Fortnightly' }));
    expect(screen.getByText('Page 1 / 2')).toBeInTheDocument();
  });
});
