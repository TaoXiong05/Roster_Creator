import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { StaffEditPage } from '../StaffEditPage';
import { api } from '../../api/client';
import { QueryProvider } from '../../testUtils';

vi.mock('../../api/client', () => ({
  api: {
    staff: { get: vi.fn(), update: vi.fn(), updatePreference: vi.fn() },
    shiftTemplates: { list: vi.fn() },
    responsibilities: { list: vi.fn() },
  },
}));

const staffWith = (overrides: Record<string, unknown> = {}) => ({
  id: 'staff-1',
  name: 'Alice',
  email: 'alice@b.com',
  responsibilityIds: ['resp-1'],
  preference: null,
  ...overrides,
});

const renderEditPage = () =>
  render(
    <QueryProvider>
    <MemoryRouter initialEntries={['/staff/staff-1']}>
      <Routes>
        <Route path="/staff/:id" element={<StaffEditPage />} />
      </Routes>
    </MemoryRouter>
    </QueryProvider>
  );

describe('StaffEditPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.shiftTemplates.list as any).mockResolvedValue([]);
    (api.responsibilities.list as any).mockResolvedValue([]);
  });

  it('loads staff data and saves updated fields', async () => {
    (api.staff.get as any).mockResolvedValue({
      id: 'staff-1',
      name: 'Alice',
      email: 'alice@b.com',
      responsibilityIds: ['resp-1'],
      preference: {
        id: 'pref-1',
        staffId: 'staff-1',
        preferredShifts: [{ weekday: 1, shiftTemplateId: 'template-1' }],
        unavailableShifts: [{ weekday: 4, shiftTemplateId: 'template-1' }],
        unavailableDateRanges: [],
        minHours: 10,
        maxHours: 30,
        hoursPeriod: 'fortnightly',
        hoursUnit: 'shifts',
      },
    });
    (api.staff.update as any).mockResolvedValue({});
    (api.staff.updatePreference as any).mockResolvedValue({});

    render(
      <QueryProvider>
      <MemoryRouter initialEntries={['/staff/staff-1']}>
        <Routes>
          <Route path="/staff/:id" element={<StaffEditPage />} />
        </Routes>
      </MemoryRouter>
      </QueryProvider>
    );

    await waitFor(() => expect(screen.getByDisplayValue('Alice')).toBeInTheDocument());

    // Step 1 → 2
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    // Step 2 → 3
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    // Step 3 → 4
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(api.staff.update).toHaveBeenCalledWith('staff-1', {
        name: 'Alice',
        email: 'alice@b.com',
        responsibilityIds: ['resp-1'],
      })
    );
    expect(api.staff.updatePreference).toHaveBeenCalledWith(
      'staff-1',
      expect.objectContaining({
        minHours: 10,
        maxHours: 30,
        hoursPeriod: 'fortnightly',
        hoursUnit: 'shifts',
        preferredShifts: [{ weekday: 1, shiftTemplateId: 'template-1' }],
        unavailableShifts: [{ weekday: 4, shiftTemplateId: 'template-1' }],
      })
    );
  });

  it("keeps a previously-set weekday's shifts untouched when configuring a different weekday", async () => {
    (api.staff.get as any).mockResolvedValue({
      id: 'staff-1',
      name: 'Alice',
      email: 'alice@b.com',
      responsibilityIds: ['resp-1'],
      preference: null,
    });
    (api.shiftTemplates.list as any).mockResolvedValue([
      { id: 'template-1', name: 'Morning', startTime: '06:00', endTime: '14:00' },
      { id: 'template-2', name: 'Evening', startTime: '14:00', endTime: '22:00' },
    ]);
    (api.staff.update as any).mockResolvedValue({});
    (api.staff.updatePreference as any).mockResolvedValue({});

    render(
      <QueryProvider>
      <MemoryRouter initialEntries={['/staff/staff-1']}>
        <Routes>
          <Route path="/staff/:id" element={<StaffEditPage />} />
        </Routes>
      </MemoryRouter>
      </QueryProvider>
    );

    await waitFor(() => expect(screen.getByDisplayValue('Alice')).toBeInTheDocument());

    // Reach Step 3 (preferred shifts)
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    const [minInput, maxInput] = screen.getAllByRole('spinbutton');
    await userEvent.clear(minInput);
    await userEvent.type(minInput, '10');
    await userEvent.clear(maxInput);
    await userEvent.type(maxInput, '40');

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    await userEvent.click(screen.getByRole('button', { name: 'Sun' }));
    await userEvent.click(screen.getByRole('button', { name: 'Morning' }));

    await userEvent.click(screen.getByRole('button', { name: 'Mon' }));
    await userEvent.click(screen.getByRole('button', { name: 'Evening' }));

    // Reach Step 4 and save
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(api.staff.updatePreference).toHaveBeenCalledWith(
        'staff-1',
        expect.objectContaining({
          preferredShifts: expect.arrayContaining([
            { weekday: 0, shiftTemplateId: 'template-1' },
            { weekday: 1, shiftTemplateId: 'template-2' },
          ]),
        })
      )
    );
  });

  it('saves the selected responsibilityIds', async () => {
    (api.staff.get as any).mockResolvedValue({
      id: 'staff-1',
      name: 'Alice',
      email: 'alice@b.com',
      responsibilityIds: ['resp-1'],
      preference: null,
    });
    (api.responsibilities.list as any).mockResolvedValue([
      { id: 'resp-1', name: 'Cashier' },
      { id: 'resp-2', name: 'Cleaning' },
    ]);
    (api.staff.update as any).mockResolvedValue({});
    (api.staff.updatePreference as any).mockResolvedValue({});

    render(
      <QueryProvider>
      <MemoryRouter initialEntries={['/staff/staff-1']}>
        <Routes>
          <Route path="/staff/:id" element={<StaffEditPage />} />
        </Routes>
      </MemoryRouter>
      </QueryProvider>
    );

    await waitFor(() => expect(screen.getByDisplayValue('Alice')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Cashier' })).toHaveClass('bg-coral-deep');
    expect(screen.getByRole('button', { name: 'Cleaning' })).not.toHaveClass('bg-coral-deep');

    await userEvent.click(screen.getByRole('button', { name: 'Cleaning' }));

    // Step 1 → 4
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    const [minInput, maxInput] = screen.getAllByRole('spinbutton');
    await userEvent.clear(minInput);
    await userEvent.type(minInput, '10');
    await userEvent.clear(maxInput);
    await userEvent.type(maxInput, '40');

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(api.staff.update).toHaveBeenCalledWith(
        'staff-1',
        expect.objectContaining({ responsibilityIds: ['resp-1', 'resp-2'] })
      )
    );
  });

  it('blocks saving when the last responsibility is deselected', async () => {
    (api.staff.get as any).mockResolvedValue({
      id: 'staff-1',
      name: 'Alice',
      email: 'alice@b.com',
      responsibilityIds: ['resp-1'],
      preference: null,
    });
    (api.responsibilities.list as any).mockResolvedValue([{ id: 'resp-1', name: 'Cashier' }]);

    render(
      <QueryProvider>
      <MemoryRouter initialEntries={['/staff/staff-1']}>
        <Routes>
          <Route path="/staff/:id" element={<StaffEditPage />} />
        </Routes>
      </MemoryRouter>
      </QueryProvider>
    );

    await waitFor(() => expect(screen.getByDisplayValue('Alice')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Cashier' }));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Please select at least one role');
    expect(api.staff.update).not.toHaveBeenCalled();
  });

  it('saves unavailable shifts independently from preferred shifts', async () => {
    (api.staff.get as any).mockResolvedValue({
      id: 'staff-1',
      name: 'Alice',
      email: 'alice@b.com',
      responsibilityIds: ['resp-1'],
      preference: null,
    });
    (api.shiftTemplates.list as any).mockResolvedValue([
      { id: 'template-1', name: 'Morning', startTime: '06:00', endTime: '14:00' },
    ]);
    (api.staff.update as any).mockResolvedValue({});
    (api.staff.updatePreference as any).mockResolvedValue({});

    render(
      <QueryProvider>
      <MemoryRouter initialEntries={['/staff/staff-1']}>
        <Routes>
          <Route path="/staff/:id" element={<StaffEditPage />} />
        </Routes>
      </MemoryRouter>
      </QueryProvider>
    );

    await waitFor(() => expect(screen.getByDisplayValue('Alice')).toBeInTheDocument());

    // Reach Step 3 (preferred shifts)
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    const [minInput, maxInput] = screen.getAllByRole('spinbutton');
    await userEvent.clear(minInput);
    await userEvent.type(minInput, '10');
    await userEvent.clear(maxInput);
    await userEvent.type(maxInput, '40');

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    await userEvent.click(screen.getByRole('button', { name: 'Mon' }));
    await userEvent.click(screen.getByRole('button', { name: 'Morning' }));

    // Reach Step 4 (unavailable shifts)
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    await userEvent.click(screen.getByRole('button', { name: 'Unavailable Fri' }));
    await userEvent.click(screen.getByRole('button', { name: 'Unavailable Morning' }));

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(api.staff.updatePreference).toHaveBeenCalledWith(
        'staff-1',
        expect.objectContaining({
          preferredShifts: [{ weekday: 1, shiftTemplateId: 'template-1' }],
          unavailableShifts: [{ weekday: 5, shiftTemplateId: 'template-1' }],
        })
      )
    );
  });

  it('lets the user jump directly to any step via the stepper', async () => {
    (api.staff.get as any).mockResolvedValue(staffWith());
    (api.staff.update as any).mockResolvedValue({});
    (api.staff.updatePreference as any).mockResolvedValue({});

    renderEditPage();

    await waitFor(() => expect(screen.getByDisplayValue('Alice')).toBeInTheDocument());

    // Jump forward from Basic Info straight to Preferred Working Times (skip steps)
    await userEvent.click(screen.getByRole('button', { name: 'Preferred Working Times' }));
    expect(await screen.findByRole('heading', { name: 'Preferred Working Times' })).toBeInTheDocument();

    // Jump forward again to Unavailable Working Times
    await userEvent.click(screen.getByRole('button', { name: 'Unavailable Working Times' }));
    expect(await screen.findByRole('heading', { name: 'Unavailable Working Times' })).toBeInTheDocument();

    // Jump backward to the first step
    await userEvent.click(screen.getByRole('button', { name: /^Basic Info/ }));
    expect(await screen.findByLabelText('Name')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Unavailable Working Times' })).not.toBeInTheDocument();
  });

  it('blocks jumping away from Basic Info when no responsibility is selected', async () => {
    (api.staff.get as any).mockResolvedValue(staffWith());
    (api.responsibilities.list as any).mockResolvedValue([{ id: 'resp-1', name: 'Cashier' }]);

    renderEditPage();

    await waitFor(() => expect(screen.getByDisplayValue('Alice')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Cashier' })); // deselect the only role
    await userEvent.click(screen.getByRole('button', { name: 'Working Hours' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Please select at least one role');
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Working Hours' })).not.toBeInTheDocument();
  });

  it('blocks jumping away from Basic Info with an empty name', async () => {
    (api.staff.get as any).mockResolvedValue(staffWith());

    renderEditPage();

    await waitFor(() => expect(screen.getByDisplayValue('Alice')).toBeInTheDocument());

    await userEvent.clear(screen.getByLabelText('Name'));
    await userEvent.click(screen.getByRole('button', { name: 'Working Hours' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Please enter a name');
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Working Hours' })).not.toBeInTheDocument();
  });

  it('blocks jumping away from Working Hours when min exceeds max', async () => {
    (api.staff.get as any).mockResolvedValue(staffWith());
    (api.staff.update as any).mockResolvedValue({});
    (api.staff.updatePreference as any).mockResolvedValue({});

    renderEditPage();

    await waitFor(() => expect(screen.getByDisplayValue('Alice')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Working Hours' }));
    expect(await screen.findByRole('heading', { name: 'Working Hours' })).toBeInTheDocument();

    const [minInput, maxInput] = screen.getAllByRole('spinbutton');
    await userEvent.clear(minInput);
    await userEvent.type(minInput, '50');
    await userEvent.clear(maxInput);
    await userEvent.type(maxInput, '40');

    await userEvent.click(screen.getByRole('button', { name: 'Preferred Working Times' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Minimum cannot exceed Maximum');
    expect(screen.getByRole('heading', { name: 'Working Hours' })).toBeInTheDocument();
  });

  it('blocks jumping away from Working Hours when minHours/maxHours are non-positive', async () => {
    (api.staff.get as any).mockResolvedValue(
      staffWith({
        preference: {
          id: 'pref-1',
          staffId: 'staff-1',
          preferredShifts: [],
          unavailableShifts: [],
          unavailableDateRanges: [],
          minHours: 0,
          maxHours: 0,
          hoursPeriod: 'weekly',
          hoursUnit: 'hours',
        },
      })
    );
    (api.staff.update as any).mockResolvedValue({});
    (api.staff.updatePreference as any).mockResolvedValue({});

    renderEditPage();

    await waitFor(() => expect(screen.getByDisplayValue('Alice')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Working Hours' }));
    expect(await screen.findByRole('heading', { name: 'Working Hours' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Preferred Working Times' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Min and Max must be greater than 0');
    expect(screen.getByRole('heading', { name: 'Working Hours' })).toBeInTheDocument();
    expect(api.staff.update).not.toHaveBeenCalled();
  });

  it('advances past Working Hours once valid positive min/max values are entered', async () => {
    (api.staff.get as any).mockResolvedValue(staffWith({ preference: null }));
    (api.staff.update as any).mockResolvedValue({});
    (api.staff.updatePreference as any).mockResolvedValue({});

    renderEditPage();

    await waitFor(() => expect(screen.getByDisplayValue('Alice')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Working Hours' }));
    expect(await screen.findByRole('heading', { name: 'Working Hours' })).toBeInTheDocument();

    const [minInput, maxInput] = screen.getAllByRole('spinbutton');
    await userEvent.clear(minInput);
    await userEvent.type(minInput, '10');
    await userEvent.clear(maxInput);
    await userEvent.type(maxInput, '40');

    await userEvent.click(screen.getByRole('button', { name: 'Preferred Working Times' }));

    expect(await screen.findByRole('heading', { name: 'Preferred Working Times' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
