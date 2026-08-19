import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { StaffCreatePage } from '../StaffCreatePage';
import { api } from '../../api/client';

vi.mock('../../api/client', () => ({
  api: {
    staff: { create: vi.fn(), updatePreference: vi.fn() },
    shiftTemplates: { list: vi.fn() },
    responsibilities: { list: vi.fn() },
  },
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/staff/new']}>
      <Routes>
        <Route path="/staff/new" element={<StaffCreatePage />} />
        <Route path="/staff" element={<div>staff list</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('StaffCreatePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.shiftTemplates.list as any).mockResolvedValue([]);
    (api.responsibilities.list as any).mockResolvedValue([]);
  });

  it('blocks submission with a clear message when no responsibility is selected', async () => {
    (api.responsibilities.list as any).mockResolvedValue([{ id: 'resp-1', name: 'Cashier' }]);

    renderPage();

    await waitFor(() => expect(api.responsibilities.list).toHaveBeenCalled());
    await userEvent.type(screen.getByPlaceholderText('姓名'), 'Bob');
    await userEvent.type(screen.getByPlaceholderText('邮箱'), 'bob@b.com');
    await userEvent.click(screen.getByRole('button', { name: '添加员工' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('请至少选择一个职责');
    expect(api.staff.create).not.toHaveBeenCalled();
  });

  it('creates a staff member with selected responsibilities', async () => {
    (api.responsibilities.list as any).mockResolvedValue([
      { id: 'resp-1', name: 'Cashier' },
      { id: 'resp-2', name: 'Cleaning' },
    ]);
    (api.staff.create as any).mockResolvedValue({ id: 'staff-1', name: 'Bob', email: 'bob@b.com' });
    (api.staff.updatePreference as any).mockResolvedValue({});

    renderPage();

    await waitFor(() => expect(api.responsibilities.list).toHaveBeenCalled());
    await userEvent.type(screen.getByPlaceholderText('姓名'), 'Bob');
    await userEvent.type(screen.getByPlaceholderText('邮箱'), 'bob@b.com');
    await userEvent.click(screen.getByRole('button', { name: 'Cashier' }));
    await userEvent.click(screen.getByRole('button', { name: '添加员工' }));

    await waitFor(() =>
      expect(api.staff.create).toHaveBeenCalledWith({
        name: 'Bob',
        email: 'bob@b.com',
        responsibilityIds: ['resp-1'],
      })
    );
  });
});
