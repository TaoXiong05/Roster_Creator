import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { PreferenceFields } from '../PreferenceFields';

const templates = [
  { id: 'template-1', name: 'Morning', startTime: '06:00', endTime: '14:00' },
  { id: 'template-2', name: 'Evening', startTime: '14:00', endTime: '22:00' },
];

const baseProps = {
  templates,
  minHours: 0,
  maxHours: 40,
  onMinHoursChange: vi.fn(),
  onMaxHoursChange: vi.fn(),
  hoursPeriod: 'weekly' as const,
  onHoursPeriodChange: vi.fn(),
  hoursUnit: 'hours' as const,
  onHoursUnitChange: vi.fn(),
  preferredShifts: [] as { weekday: number; shiftTemplateId: string }[],
  activeWeekday: null as number | null,
  onSelectWeekday: vi.fn(),
  onToggleShift: vi.fn(),
};

describe('PreferenceFields', () => {
  it('prompts to set up a shift template when none exist', () => {
    render(
      <MemoryRouter>
        <PreferenceFields {...baseProps} templates={[]} />
      </MemoryRouter>
    );

    expect(screen.getByText(/还没有设置班次模板/)).toBeInTheDocument();
    expect(screen.queryByText('Morning')).not.toBeInTheDocument();
  });

  it('hides the shift picker until a weekday is selected', () => {
    render(
      <MemoryRouter>
        <PreferenceFields {...baseProps} />
      </MemoryRouter>
    );

    expect(screen.getByText(/先选择上面偏好上班的星期几/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Morning' })).not.toBeInTheDocument();
  });

  it('shows a single shared shift picker scoped to the active weekday', () => {
    render(
      <MemoryRouter>
        <PreferenceFields
          {...baseProps}
          activeWeekday={1}
          preferredShifts={[{ weekday: 1, shiftTemplateId: 'template-1' }]}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('周一想上的班次')).toBeInTheDocument();
    // Only one picker is rendered (not one per configured day)
    expect(screen.getAllByRole('button', { name: 'Morning' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Morning' })).toHaveClass('bg-coral-deep');
    expect(screen.getByRole('button', { name: 'Evening' })).not.toHaveClass('bg-coral-deep');
  });

  it('calls onSelectWeekday when a weekday pill is clicked, and highlights only the active one', async () => {
    const onSelectWeekday = vi.fn();
    render(
      <MemoryRouter>
        <PreferenceFields {...baseProps} activeWeekday={0} onSelectWeekday={onSelectWeekday} />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: '周日' })).toHaveClass('bg-coral-deep');
    expect(screen.getByRole('button', { name: '周一' })).not.toHaveClass('bg-coral-deep');

    await userEvent.click(screen.getByRole('button', { name: '周一' }));
    expect(onSelectWeekday).toHaveBeenCalledWith(1);
  });

  it('calls onToggleShift scoped to the active weekday when a shift pill is clicked', async () => {
    const onToggleShift = vi.fn();
    render(
      <MemoryRouter>
        <PreferenceFields {...baseProps} activeWeekday={1} onToggleShift={onToggleShift} />
      </MemoryRouter>
    );

    await userEvent.click(screen.getByRole('button', { name: 'Morning' }));
    expect(onToggleShift).toHaveBeenCalledWith(1, 'template-1');
  });

  it('shows a summary of every configured weekday, independent of which one is active', () => {
    render(
      <MemoryRouter>
        <PreferenceFields
          {...baseProps}
          activeWeekday={1}
          preferredShifts={[
            { weekday: 0, shiftTemplateId: 'template-1' },
            { weekday: 1, shiftTemplateId: 'template-2' },
          ]}
        />
      </MemoryRouter>
    );

    const summary = screen.getByText('偏好总结').closest('div')!;
    expect(summary).toHaveTextContent('周日：Morning');
    expect(summary).toHaveTextContent('周一：Evening');
  });

  it('has no summary section when nothing is configured yet', () => {
    render(
      <MemoryRouter>
        <PreferenceFields {...baseProps} />
      </MemoryRouter>
    );

    expect(screen.queryByText('偏好总结')).not.toBeInTheDocument();
  });

  it('marks configured weekdays with a checkmark, even when not the active one', () => {
    render(
      <MemoryRouter>
        <PreferenceFields
          {...baseProps}
          activeWeekday={1}
          preferredShifts={[{ weekday: 0, shiftTemplateId: 'template-1' }]}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: '周日' }).querySelector('svg')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '周一' }).querySelector('svg')).not.toBeInTheDocument();
  });

  it('lets the user pick a weekly, fortnightly, or monthly hours period from a dropdown', async () => {
    const onHoursPeriodChange = vi.fn();
    render(
      <MemoryRouter>
        <PreferenceFields {...baseProps} hoursPeriod="weekly" onHoursPeriodChange={onHoursPeriodChange} />
      </MemoryRouter>
    );

    const select = screen.getByLabelText('工时周期') as HTMLSelectElement;
    expect(select.value).toBe('weekly');

    await userEvent.selectOptions(select, 'fortnightly');
    expect(onHoursPeriodChange).toHaveBeenCalledWith('fortnightly');
  });

  it('lets the user pick between an hours count and a shifts count from a dropdown', async () => {
    const onHoursUnitChange = vi.fn();
    render(
      <MemoryRouter>
        <PreferenceFields {...baseProps} hoursUnit="hours" onHoursUnitChange={onHoursUnitChange} />
      </MemoryRouter>
    );

    const select = screen.getByLabelText('计算方式') as HTMLSelectElement;
    expect(select.value).toBe('hours');

    await userEvent.selectOptions(select, 'shifts');
    expect(onHoursUnitChange).toHaveBeenCalledWith('shifts');
  });

  it('relabels the min/max fields to match the selected unit', () => {
    const { rerender } = render(
      <MemoryRouter>
        <PreferenceFields {...baseProps} hoursUnit="hours" />
      </MemoryRouter>
    );
    expect(screen.getByText('最小工时')).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <PreferenceFields {...baseProps} hoursUnit="shifts" />
      </MemoryRouter>
    );
    expect(screen.getByText('最小班次数')).toBeInTheDocument();
  });
});
