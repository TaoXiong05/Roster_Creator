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

  it('creates a roster by setting shifts through the per-day dialog, with a custom hoursPerShift', async () => {
    (api.shiftTemplates.list as any).mockResolvedValue([
      { id: 'template-1', name: 'Morning', startTime: '06:00', endTime: '14:00' },
      { id: 'template-2', name: 'Evening', startTime: '14:00', endTime: '22:00' },
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

    const hoursPerShift = screen.getByLabelText('每个班次等于多少小时');
    await userEvent.clear(hoursPerShift);
    await userEvent.type(hoursPerShift, '6');

    // Day 1: open the dialog, add Morning, set headcount to 3, close.
    await userEvent.click(screen.getByRole('button', { name: /08-17/ }));
    await userEvent.click(await screen.findByRole('button', { name: '+ Morning' }));
    const morningHeadcount = screen.getByLabelText('Morning 所需人数');
    await userEvent.clear(morningHeadcount);
    await userEvent.type(morningHeadcount, '3');
    await userEvent.click(screen.getByRole('button', { name: '完成' }));

    // Day 2: same flow with Evening, headcount 4.
    await userEvent.click(screen.getByRole('button', { name: /08-18/ }));
    await userEvent.click(await screen.findByRole('button', { name: '+ Evening' }));
    const eveningHeadcount = screen.getByLabelText('Evening 所需人数');
    await userEvent.clear(eveningHeadcount);
    await userEvent.type(eveningHeadcount, '4');
    await userEvent.click(screen.getByRole('button', { name: '完成' }));

    await userEvent.click(screen.getByRole('button', { name: '创建排班' }));

    await waitFor(() =>
      expect(api.rosters.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Week 34',
          dateRangeStart: '2026-08-17',
          dateRangeEnd: '2026-08-18',
          groupId: 'group-1',
          hoursPerShift: 6,
          shifts: expect.arrayContaining([
            expect.objectContaining({ shiftTemplateId: 'template-1', dates: ['2026-08-17'], headcount: 3 }),
            expect.objectContaining({ shiftTemplateId: 'template-2', dates: ['2026-08-18'], headcount: 4 }),
          ]),
        })
      )
    );
  });

  it('blocks submission with a clear message when no shifts are set', async () => {
    (api.shiftTemplates.list as any).mockResolvedValue([
      { id: 'template-1', name: 'Morning', startTime: '06:00', endTime: '14:00' },
    ]);
    (api.groups.list as any).mockResolvedValue([{ id: 'group-1', name: 'Kitchen', memberCount: 2 }]);

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

    await userEvent.click(screen.getByRole('button', { name: '创建排班' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('至少需要为一天设置一个班次的人数');
    expect(api.rosters.create).not.toHaveBeenCalled();
  });

  it('removing a shift from a day drops it from submission', async () => {
    (api.shiftTemplates.list as any).mockResolvedValue([
      { id: 'template-1', name: 'Morning', startTime: '06:00', endTime: '14:00' },
    ]);
    (api.groups.list as any).mockResolvedValue([{ id: 'group-1', name: 'Kitchen', memberCount: 2 }]);

    render(
      <MemoryRouter>
        <RosterCreatePage />
      </MemoryRouter>
    );

    await waitFor(() => expect(api.shiftTemplates.list).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText('开始日期'), { target: { value: '2026-08-17' } });
    fireEvent.change(screen.getByLabelText('结束日期'), { target: { value: '2026-08-17' } });

    await userEvent.click(screen.getByRole('button', { name: /08-17/ }));
    await userEvent.click(await screen.findByRole('button', { name: '+ Morning' }));
    expect(screen.getByLabelText('Morning 所需人数')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '移除Morning' }));
    expect(screen.queryByLabelText('Morning 所需人数')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Morning' })).toBeInTheDocument();
  });

  it('paginates the calendar 7 days at a time', async () => {
    (api.shiftTemplates.list as any).mockResolvedValue([
      { id: 'template-1', name: 'Morning', startTime: '06:00', endTime: '14:00' },
    ]);
    (api.groups.list as any).mockResolvedValue([{ id: 'group-1', name: 'Kitchen', memberCount: 2 }]);

    render(
      <MemoryRouter>
        <RosterCreatePage />
      </MemoryRouter>
    );

    await waitFor(() => expect(api.shiftTemplates.list).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText('开始日期'), { target: { value: '2026-08-01' } });
    fireEvent.change(screen.getByLabelText('结束日期'), { target: { value: '2026-08-10' } });

    expect(screen.getByRole('button', { name: /08-01/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /08-08/ })).not.toBeInTheDocument();
    expect(screen.getByText('第 1 / 2 页')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '下一周 →' }));

    expect(screen.queryByRole('button', { name: /08-01/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /08-08/ })).toBeInTheDocument();
    expect(screen.getByText('第 2 / 2 页')).toBeInTheDocument();
  });
});
