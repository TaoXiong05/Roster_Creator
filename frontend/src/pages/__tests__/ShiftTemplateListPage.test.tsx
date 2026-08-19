import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ShiftTemplateListPage } from '../ShiftTemplateListPage';
import { api } from '../../api/client';

vi.mock('../../api/client', () => ({
  api: { shiftTemplates: { list: vi.fn(), create: vi.fn(), remove: vi.fn() } },
}));

describe('ShiftTemplateListPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists existing templates', async () => {
    (api.shiftTemplates.list as any).mockResolvedValue([
      { id: 'template-1', name: 'Morning', startTime: '06:00', endTime: '14:00' },
    ]);

    render(
      <MemoryRouter>
        <ShiftTemplateListPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText(/Morning/)).toBeInTheDocument());
  });

  it('creates a template from the form', async () => {
    (api.shiftTemplates.list as any).mockResolvedValue([]);
    (api.shiftTemplates.create as any).mockResolvedValue({
      id: 'template-1',
      name: 'Evening',
      startTime: '14:00',
      endTime: '22:00',
    });

    render(
      <MemoryRouter>
        <ShiftTemplateListPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(api.shiftTemplates.list).toHaveBeenCalled());
    await userEvent.type(screen.getByPlaceholderText('名称（如：早班）'), 'Evening');
    await userEvent.click(screen.getByRole('button', { name: '添加模板' }));

    await waitFor(() =>
      expect(api.shiftTemplates.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Evening' })
      )
    );
  });
});
