import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ResponsibilityListPage } from '../ResponsibilityListPage';
import { api } from '../../api/client';

vi.mock('../../api/client', () => ({
  api: { responsibilities: { list: vi.fn(), create: vi.fn(), remove: vi.fn(), update: vi.fn() } },
}));

describe('ResponsibilityListPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists existing responsibilities', async () => {
    (api.responsibilities.list as any).mockResolvedValue([{ id: 'resp-1', name: 'Cashier' }]);

    render(
      <MemoryRouter>
        <ResponsibilityListPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Cashier')).toBeInTheDocument());
  });

  it('creates a responsibility from the form', async () => {
    (api.responsibilities.list as any).mockResolvedValue([]);
    (api.responsibilities.create as any).mockResolvedValue({ id: 'resp-1', name: 'Cashier' });

    render(
      <MemoryRouter>
        <ResponsibilityListPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(api.responsibilities.list).toHaveBeenCalled());
    await userEvent.type(screen.getByPlaceholderText('名称（如：收银）'), 'Cashier');
    await userEvent.click(screen.getByRole('button', { name: '添加职责' }));

    await waitFor(() => expect(api.responsibilities.create).toHaveBeenCalledWith('Cashier'));
  });

  it('edits a responsibility', async () => {
    (api.responsibilities.list as any).mockResolvedValue([{ id: 'resp-1', name: 'Cashier' }]);
    (api.responsibilities.update as any).mockResolvedValue({ id: 'resp-1', name: 'Head Cashier' });

    render(
      <MemoryRouter>
        <ResponsibilityListPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Cashier')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: '编辑' }));

    const nameInput = screen.getAllByLabelText('职责名称')[1];
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Head Cashier');
    await userEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => expect(api.responsibilities.update).toHaveBeenCalledWith('resp-1', 'Head Cashier'));
  });

  it('deletes a responsibility after confirmation', async () => {
    (api.responsibilities.list as any).mockResolvedValue([{ id: 'resp-1', name: 'Cashier' }]);
    (api.responsibilities.remove as any).mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <ResponsibilityListPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Cashier')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: '删除' }));
    await userEvent.click(await screen.findByRole('button', { name: '确认删除' }));

    await waitFor(() => expect(api.responsibilities.remove).toHaveBeenCalledWith('resp-1'));
  });
});
