import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { StaffCreatePage } from '../StaffCreatePage';
import { api } from '../../api/client';
import { QueryProvider } from '../../testUtils';

vi.mock('../../api/client', () => ({
  api: {
    staff: { create: vi.fn(), updatePreference: vi.fn() },
    shiftTemplates: { list: vi.fn() },
    responsibilities: { list: vi.fn() },
  },
}));

function renderPage() {
  return render(
    <QueryProvider>
    <MemoryRouter initialEntries={['/staff/new']}>
      <Routes>
        <Route path="/staff/new" element={<StaffCreatePage />} />
        <Route path="/staff" element={<div>staff list</div>} />
      </Routes>
    </MemoryRouter>
    </QueryProvider>
  );
}

describe('StaffCreatePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.shiftTemplates.list as any).mockResolvedValue([]);
    (api.responsibilities.list as any).mockResolvedValue([]);
  });

  it('blocks advancing to step 2 with a clear message when no role is selected', async () => {
    (api.responsibilities.list as any).mockResolvedValue([{ id: 'resp-1', name: 'Cashier' }]);

    renderPage();

    await waitFor(() => expect(api.responsibilities.list).toHaveBeenCalled());
    await userEvent.type(screen.getByPlaceholderText('Name'), 'Bob');
    await userEvent.type(screen.getByPlaceholderText('Email'), 'bob@b.com');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Please select at least one role');
    expect(api.staff.create).not.toHaveBeenCalled();
  });

  it('blocks advancing past Working Hours when minHours/maxHours are left at their 0/0 defaults', async () => {
    (api.responsibilities.list as any).mockResolvedValue([{ id: 'resp-1', name: 'Cashier' }]);

    renderPage();

    await waitFor(() => expect(api.responsibilities.list).toHaveBeenCalled());
    await userEvent.type(screen.getByPlaceholderText('Name'), 'Bob');
    await userEvent.type(screen.getByPlaceholderText('Email'), 'bob@b.com');
    await userEvent.click(screen.getByRole('button', { name: 'Cashier' }));

    // Step 1 → 2 (work hours)
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByRole('heading', { name: 'Working Hours' })).toBeInTheDocument();

    // minHours/maxHours default to 0/0. The number inputs' HTML min={1} constraint
    // keeps the native form submission from firing at all in this case, so the
    // wizard simply stays put on Working Hours rather than advancing.
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByRole('heading', { name: 'Working Hours' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Preferred Working Times' })).not.toBeInTheDocument();
    expect(api.staff.create).not.toHaveBeenCalled();
  });

  it('advances past Working Hours once valid positive min/max values are entered', async () => {
    (api.responsibilities.list as any).mockResolvedValue([{ id: 'resp-1', name: 'Cashier' }]);

    renderPage();

    await waitFor(() => expect(api.responsibilities.list).toHaveBeenCalled());
    await userEvent.type(screen.getByPlaceholderText('Name'), 'Bob');
    await userEvent.type(screen.getByPlaceholderText('Email'), 'bob@b.com');
    await userEvent.click(screen.getByRole('button', { name: 'Cashier' }));

    // Step 1 → 2 (work hours)
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    const [minInput, maxInput] = screen.getAllByRole('spinbutton');
    await userEvent.clear(minInput);
    await userEvent.type(minInput, '10');
    await userEvent.clear(maxInput);
    await userEvent.type(maxInput, '40');

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByRole('heading', { name: 'Preferred Working Times' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('creates a staff member with selected roles', async () => {
    (api.responsibilities.list as any).mockResolvedValue([
      { id: 'resp-1', name: 'Cashier' },
      { id: 'resp-2', name: 'Cleaning' },
    ]);
    (api.staff.create as any).mockResolvedValue({ id: 'staff-1', name: 'Bob', email: 'bob@b.com' });
    (api.staff.updatePreference as any).mockResolvedValue({});

    renderPage();

    await waitFor(() => expect(api.responsibilities.list).toHaveBeenCalled());
    await userEvent.type(screen.getByPlaceholderText('Name'), 'Bob');
    await userEvent.type(screen.getByPlaceholderText('Email'), 'bob@b.com');
    await userEvent.click(screen.getByRole('button', { name: 'Cashier' }));

    // Step 1 → 2 (work hours)
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    const [minInput, maxInput] = screen.getAllByRole('spinbutton');
    await userEvent.clear(minInput);
    await userEvent.type(minInput, '10');
    await userEvent.clear(maxInput);
    await userEvent.type(maxInput, '40');

    // Step 2 → 3 (preferred shifts)
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    // Step 3 → 4 (unavailable shifts)
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Add Staff' }));

    await waitFor(() =>
      expect(api.staff.create).toHaveBeenCalledWith({
        name: 'Bob',
        email: 'bob@b.com',
        responsibilityIds: ['resp-1'],
      })
    );
    expect(api.staff.updatePreference).toHaveBeenCalledWith(
      'staff-1',
      expect.objectContaining({ unavailableShifts: [] })
    );
  });

  it('saves selected unavailable shifts alongside preferred shifts', async () => {
    (api.shiftTemplates.list as any).mockResolvedValue([
      { id: 'template-1', name: 'Morning', startTime: '06:00', endTime: '14:00' },
    ]);
    (api.responsibilities.list as any).mockResolvedValue([{ id: 'resp-1', name: 'Cashier' }]);
    (api.staff.create as any).mockResolvedValue({ id: 'staff-1', name: 'Bob', email: 'bob@b.com' });
    (api.staff.updatePreference as any).mockResolvedValue({});

    renderPage();

    await waitFor(() => expect(api.shiftTemplates.list).toHaveBeenCalled());
    await userEvent.type(screen.getByPlaceholderText('Name'), 'Bob');
    await userEvent.type(screen.getByPlaceholderText('Email'), 'bob@b.com');
    await userEvent.click(screen.getByRole('button', { name: 'Cashier' }));

    // Step 1 → 2 (work hours)
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    const [minInput, maxInput] = screen.getAllByRole('spinbutton');
    await userEvent.clear(minInput);
    await userEvent.type(minInput, '10');
    await userEvent.clear(maxInput);
    await userEvent.type(maxInput, '40');

    // Step 2 → 3 (preferred shifts)
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    // Step 3 → 4 (unavailable shifts)
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Unavailable Mon' }));
    await userEvent.click(screen.getByRole('button', { name: 'Unavailable Morning' }));

    await userEvent.click(screen.getByRole('button', { name: 'Add Staff' }));

    await waitFor(() =>
      expect(api.staff.updatePreference).toHaveBeenCalledWith(
        'staff-1',
        expect.objectContaining({ unavailableShifts: [{ weekday: 1, shiftTemplateId: 'template-1' }] })
      )
    );
  });
});
