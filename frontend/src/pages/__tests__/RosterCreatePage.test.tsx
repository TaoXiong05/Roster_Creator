import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { RosterCreatePage } from '../RosterCreatePage';
import { api } from '../../api/client';

vi.mock('../../api/client', () => ({
  api: {
    shiftTemplates: { list: vi.fn() },
    groups: { list: vi.fn() },
    rosters: { create: vi.fn() },
  },
}));

describe('RosterCreatePage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a roster with the selected shift and dates', async () => {
    (api.shiftTemplates.list as any).mockResolvedValue([
      { id: 'template-1', name: 'Morning', startTime: '06:00', endTime: '14:00' },
    ]);
    (api.groups.list as any).mockResolvedValue([{ id: 'group-1', name: 'Kitchen', memberCount: 2 }]);
    (api.rosters.create as any).mockResolvedValue({ id: 'roster-1' });

    render(
      <MemoryRouter>
        <RosterCreatePage />
      </MemoryRouter>
    );

    await waitFor(() => expect(api.shiftTemplates.list).toHaveBeenCalled());

    await userEvent.type(screen.getByPlaceholderText('排班名称'), 'Week 34');
    fireEvent.change(screen.getByLabelText('开始日期'), { target: { value: '2026-08-17' } });
    fireEvent.change(screen.getByLabelText('结束日期'), { target: { value: '2026-08-18' } });
    await userEvent.selectOptions(screen.getByLabelText('员工小组'), 'group-1');

    await userEvent.click(screen.getByRole('button', { name: '添加班次' }));
    await userEvent.selectOptions(screen.getByLabelText('班次模板'), 'template-1');

    const dateCheckbox = await screen.findByLabelText('2026-08-17');
    await userEvent.click(dateCheckbox);

    await userEvent.click(screen.getByRole('button', { name: '创建排班' }));

    await waitFor(() =>
      expect(api.rosters.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Week 34',
          dateRangeStart: '2026-08-17',
          dateRangeEnd: '2026-08-18',
          groupId: 'group-1',
          shifts: [expect.objectContaining({ shiftTemplateId: 'template-1', dates: ['2026-08-17'], headcount: 1 })],
        })
      )
    );
  });
});
