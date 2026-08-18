import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { StaffListPage } from '../StaffListPage';
import { api } from '../../api/client';

vi.mock('../../api/client', () => ({
  api: { staff: { list: vi.fn(), create: vi.fn(), remove: vi.fn() } },
}));

describe('StaffListPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists existing staff', async () => {
    (api.staff.list as any).mockResolvedValue([
      { id: 'staff-1', name: 'Alice', email: 'alice@b.com', skills: [], preference: null },
    ]);

    render(
      <MemoryRouter>
        <StaffListPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
  });

  it('creates a staff member from the form', async () => {
    (api.staff.list as any).mockResolvedValue([]);
    (api.staff.create as any).mockResolvedValue({ id: 'staff-1', name: 'Bob', email: 'bob@b.com', skills: [] });

    render(
      <MemoryRouter>
        <StaffListPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(api.staff.list).toHaveBeenCalled());
    await userEvent.type(screen.getByPlaceholderText('姓名'), 'Bob');
    await userEvent.type(screen.getByPlaceholderText('邮箱'), 'bob@b.com');
    await userEvent.click(screen.getByRole('button', { name: '添加员工' }));

    await waitFor(() =>
      expect(api.staff.create).toHaveBeenCalledWith({ name: 'Bob', email: 'bob@b.com', skills: [] })
    );
  });
});
