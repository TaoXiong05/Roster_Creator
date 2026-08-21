import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShiftTemplateListPage } from '../ShiftTemplateListPage';
import { api } from '../../api/client';
import { renderWithProviders } from '../../testUtils';

vi.mock('../../api/client', () => ({
  api: { shiftTemplates: { list: vi.fn(), create: vi.fn(), remove: vi.fn(), update: vi.fn() } },
}));

describe('ShiftTemplateListPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists existing templates', async () => {
    (api.shiftTemplates.list as any).mockResolvedValue([
      { id: 'template-1', name: 'Morning', startTime: '06:00', endTime: '14:00' },
    ]);

    renderWithProviders(<ShiftTemplateListPage />);

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

    renderWithProviders(<ShiftTemplateListPage />);

    await waitFor(() => expect(api.shiftTemplates.list).toHaveBeenCalled());
    await userEvent.type(screen.getByPlaceholderText('Name (e.g. Morning Shift)'), 'Evening');
    await userEvent.click(screen.getByRole('button', { name: 'Add Template' }));

    await waitFor(() =>
      expect(api.shiftTemplates.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Evening' })
      )
    );
  });

  it('edits a template', async () => {
    (api.shiftTemplates.list as any).mockResolvedValue([
      { id: 'template-1', name: 'Morning', startTime: '06:00', endTime: '14:00' },
    ]);
    (api.shiftTemplates.update as any).mockResolvedValue({
      id: 'template-1',
      name: 'Early Morning',
      startTime: '05:00',
      endTime: '13:00',
    });

    renderWithProviders(<ShiftTemplateListPage />);

    await waitFor(() => expect(screen.getByText(/Morning/)).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));

    const nameInput = screen.getAllByLabelText('Template Name')[1];
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Early Morning');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(api.shiftTemplates.update).toHaveBeenCalledWith('template-1', {
        name: 'Early Morning',
        startTime: '06:00',
        endTime: '14:00',
      })
    );
  });
});
