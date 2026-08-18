import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { StaffEditPage } from '../StaffEditPage';
import { api } from '../../api/client';

vi.mock('../../api/client', () => ({
  api: { staff: { get: vi.fn(), update: vi.fn(), updatePreference: vi.fn() } },
}));

describe('StaffEditPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads staff data and saves updated fields', async () => {
    (api.staff.get as any).mockResolvedValue({
      id: 'staff-1',
      name: 'Alice',
      email: 'alice@b.com',
      skills: ['cashier'],
      preference: {
        id: 'pref-1',
        staffId: 'staff-1',
        preferredShiftTemplateIds: [],
        unavailableDateRanges: [],
        minHoursPerWeek: 10,
        maxHoursPerWeek: 30,
        preferredWeekdays: [1],
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

    await userEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() =>
      expect(api.staff.update).toHaveBeenCalledWith('staff-1', {
        name: 'Alice',
        email: 'alice@b.com',
        skills: ['cashier'],
      })
    );
    expect(api.staff.updatePreference).toHaveBeenCalledWith(
      'staff-1',
      expect.objectContaining({ minHoursPerWeek: 10, maxHoursPerWeek: 30, preferredWeekdays: [1] })
    );
  });
});
