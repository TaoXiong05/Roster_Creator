import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { StaffEditPage } from '../StaffEditPage';
import { api } from '../../api/client';

vi.mock('../../api/client', () => ({
  api: {
    staff: { get: vi.fn(), update: vi.fn(), updatePreference: vi.fn() },
    shiftTemplates: { list: vi.fn() },
    responsibilities: { list: vi.fn() },
  },
}));

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
      <MemoryRouter initialEntries={['/staff/staff-1']}>
        <Routes>
          <Route path="/staff/:id" element={<StaffEditPage />} />
        </Routes>
      </MemoryRouter>
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
      <MemoryRouter initialEntries={['/staff/staff-1']}>
        <Routes>
          <Route path="/staff/:id" element={<StaffEditPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByDisplayValue('Alice')).toBeInTheDocument());

    // Reach Step 3 (preferred shifts)
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
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
      <MemoryRouter initialEntries={['/staff/staff-1']}>
        <Routes>
          <Route path="/staff/:id" element={<StaffEditPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByDisplayValue('Alice')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Cashier' })).toHaveClass('bg-coral-deep');
    expect(screen.getByRole('button', { name: 'Cleaning' })).not.toHaveClass('bg-coral-deep');

    await userEvent.click(screen.getByRole('button', { name: 'Cleaning' }));

    // Step 1 → 4
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
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
      <MemoryRouter initialEntries={['/staff/staff-1']}>
        <Routes>
          <Route path="/staff/:id" element={<StaffEditPage />} />
        </Routes>
      </MemoryRouter>
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
      <MemoryRouter initialEntries={['/staff/staff-1']}>
        <Routes>
          <Route path="/staff/:id" element={<StaffEditPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByDisplayValue('Alice')).toBeInTheDocument());

    // Reach Step 3 (preferred shifts)
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
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
});
