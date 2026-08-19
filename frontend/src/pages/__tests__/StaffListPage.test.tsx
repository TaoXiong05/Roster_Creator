import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { StaffListPage } from '../StaffListPage';
import { api } from '../../api/client';

vi.mock('../../api/client', () => ({
  api: {
    staff: { list: vi.fn(), create: vi.fn(), remove: vi.fn(), updatePreference: vi.fn() },
    shiftTemplates: { list: vi.fn() },
    responsibilities: { list: vi.fn() },
  },
}));

describe('StaffListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.shiftTemplates.list as any).mockResolvedValue([]);
    (api.responsibilities.list as any).mockResolvedValue([]);
  });

  it('lists existing staff', async () => {
    (api.staff.list as any).mockResolvedValue([
      { id: 'staff-1', name: 'Alice', email: 'alice@b.com', responsibilityIds: ['resp-1'], preference: null },
    ]);

    render(
      <MemoryRouter>
        <StaffListPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
  });

  it('blocks submission with a clear message when no responsibility is selected', async () => {
    (api.staff.list as any).mockResolvedValue([]);
    (api.responsibilities.list as any).mockResolvedValue([{ id: 'resp-1', name: 'Cashier' }]);

    render(
      <MemoryRouter>
        <StaffListPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(api.responsibilities.list).toHaveBeenCalled());
    await userEvent.type(screen.getByPlaceholderText('姓名'), 'Bob');
    await userEvent.type(screen.getByPlaceholderText('邮箱'), 'bob@b.com');
    await userEvent.click(screen.getByRole('button', { name: '添加员工' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('请至少选择一个职责');
    expect(api.staff.create).not.toHaveBeenCalled();
  });

  it('creates a staff member with selected responsibilities', async () => {
    (api.staff.list as any).mockResolvedValue([]);
    (api.responsibilities.list as any).mockResolvedValue([
      { id: 'resp-1', name: 'Cashier' },
      { id: 'resp-2', name: 'Cleaning' },
    ]);
    (api.staff.create as any).mockResolvedValue({ id: 'staff-1', name: 'Bob', email: 'bob@b.com' });

    render(
      <MemoryRouter>
        <StaffListPage />
      </MemoryRouter>
    );

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
