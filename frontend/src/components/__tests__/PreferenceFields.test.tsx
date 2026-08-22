import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { PreferenceFields, PreferredShiftsFields, UnavailableShiftsFields, validateHoursRange } from '../PreferenceFields';
import { translate } from '../../i18n/LanguageContext';

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
  unavailableShifts: [] as { weekday: number; shiftTemplateId: string }[],
  unavailableActiveWeekday: null as number | null,
  onSelectUnavailableWeekday: vi.fn(),
  onToggleUnavailableShift: vi.fn(),
};

describe('PreferenceFields', () => {
  it('prompts to set up a shift template when none exist, once per picker section', () => {
    render(
      <MemoryRouter>
        <PreferenceFields {...baseProps} templates={[]} />
      </MemoryRouter>
    );

    // One reminder for the preferred-shifts picker, one for the unavailable-shifts picker.
    expect(screen.getAllByText(/No shift templates yet/)).toHaveLength(2);
    expect(screen.queryByText('Morning')).not.toBeInTheDocument();
  });

  it('hides the shift picker until a weekday is selected', () => {
    render(
      <MemoryRouter>
        <PreferenceFields {...baseProps} />
      </MemoryRouter>
    );

    expect(screen.getByText(/Select a preferred day above first/)).toBeInTheDocument();
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

    expect(screen.getByText('Shifts wanted on Mon')).toBeInTheDocument();
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

    expect(screen.getByRole('button', { name: 'Sun' })).toHaveClass('bg-coral-deep');
    expect(screen.getByRole('button', { name: 'Mon' })).not.toHaveClass('bg-coral-deep');

    await userEvent.click(screen.getByRole('button', { name: 'Mon' }));
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

    const summary = screen.getByText('Preference Summary').closest('div')!;
    expect(summary).toHaveTextContent('Sun: Morning');
    expect(summary).toHaveTextContent('Mon: Evening');
  });

  it('has no summary section when nothing is configured yet', () => {
    render(
      <MemoryRouter>
        <PreferenceFields {...baseProps} />
      </MemoryRouter>
    );

    expect(screen.queryByText('Preference Summary')).not.toBeInTheDocument();
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

    expect(screen.getByRole('button', { name: 'Sun' }).querySelector('svg')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mon' }).querySelector('svg')).not.toBeInTheDocument();
  });

  it('lets the user pick a weekly, fortnightly, or monthly hours period from a dropdown', async () => {
    const onHoursPeriodChange = vi.fn();
    render(
      <MemoryRouter>
        <PreferenceFields {...baseProps} hoursPeriod="weekly" onHoursPeriodChange={onHoursPeriodChange} />
      </MemoryRouter>
    );

    const select = screen.getByLabelText('Duration') as HTMLSelectElement;
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

    const select = screen.getByLabelText('Unit') as HTMLSelectElement;
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
    expect(screen.getByText('Min Hours')).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <PreferenceFields {...baseProps} hoursUnit="shifts" />
      </MemoryRouter>
    );
    expect(screen.getByText('Min Shifts')).toBeInTheDocument();
  });

  it('mirrors the preferred-shifts picker for unavailable shifts, scoped to its own active weekday', () => {
    render(
      <MemoryRouter>
        <PreferenceFields
          {...baseProps}
          activeWeekday={0}
          unavailableActiveWeekday={2}
          unavailableShifts={[{ weekday: 2, shiftTemplateId: 'template-1' }]}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('Unavailable shifts on Tue')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unavailable Morning' })).toHaveClass('bg-red-500');
    expect(screen.getByRole('button', { name: 'Unavailable Evening' })).not.toHaveClass('bg-red-500');
    // The preferred-shifts picker is unaffected and still has its own bare "Morning" button.
    expect(screen.getByRole('button', { name: 'Morning' })).toBeInTheDocument();
  });

  it('calls onSelectUnavailableWeekday independently from the preferred weekday selector', async () => {
    const onSelectWeekday = vi.fn();
    const onSelectUnavailableWeekday = vi.fn();
    render(
      <MemoryRouter>
        <PreferenceFields
          {...baseProps}
          onSelectWeekday={onSelectWeekday}
          onSelectUnavailableWeekday={onSelectUnavailableWeekday}
        />
      </MemoryRouter>
    );

    await userEvent.click(screen.getByRole('button', { name: 'Unavailable Wed' }));
    expect(onSelectUnavailableWeekday).toHaveBeenCalledWith(3);
    expect(onSelectWeekday).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Wed' }));
    expect(onSelectWeekday).toHaveBeenCalledWith(3);
  });

  it('calls onToggleUnavailableShift scoped to the active weekday when an unavailable shift pill is clicked', async () => {
    const onToggleUnavailableShift = vi.fn();
    render(
      <MemoryRouter>
        <PreferenceFields
          {...baseProps}
          unavailableActiveWeekday={1}
          onToggleUnavailableShift={onToggleUnavailableShift}
        />
      </MemoryRouter>
    );

    await userEvent.click(screen.getByRole('button', { name: 'Unavailable Morning' }));
    expect(onToggleUnavailableShift).toHaveBeenCalledWith(1, 'template-1');
  });

  it('shows a separate summary and checkmarks for configured unavailable weekdays', () => {
    render(
      <MemoryRouter>
        <PreferenceFields
          {...baseProps}
          unavailableActiveWeekday={2}
          unavailableShifts={[
            { weekday: 0, shiftTemplateId: 'template-1' },
            { weekday: 2, shiftTemplateId: 'template-2' },
          ]}
        />
      </MemoryRouter>
    );

    const summary = screen.getByText('Unavailable Summary').closest('div')!;
    expect(summary).toHaveTextContent('Sun: Morning');
    expect(summary).toHaveTextContent('Tue: Evening');
    expect(screen.getByRole('button', { name: 'Unavailable Sun' }).querySelector('svg')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unavailable Mon' }).querySelector('svg')).not.toBeInTheDocument();
    // The preferred-shifts summary is unaffected and still absent when nothing is configured there.
    expect(screen.queryByText('Preference Summary')).not.toBeInTheDocument();
  });
});

describe('validateHoursRange', () => {
  const t = (key: string, vars?: Record<string, string | number>) => translate('en', key, vars);

  it('returns the minPositiveError when minHours is not greater than 0', () => {
    expect(validateHoursRange(0, 40, t)).toBe('Min and Max must be greater than 0');
  });

  it('returns the minPositiveError when maxHours is not greater than 0', () => {
    expect(validateHoursRange(10, 0, t)).toBe('Min and Max must be greater than 0');
  });

  it('returns the minMaxError when minHours exceeds maxHours', () => {
    expect(validateHoursRange(50, 40, t)).toBe('Minimum cannot exceed Maximum');
  });

  it('returns null for a valid positive range', () => {
    expect(validateHoursRange(10, 40, t)).toBeNull();
  });
});

describe('WeekdayShiftSection hints', () => {
  const shiftsSectionBaseProps = {
    templates,
    entries: [] as { weekday: number; shiftTemplateId: string }[],
    activeWeekday: null as number | null,
    onSelectWeekday: vi.fn(),
    onToggleShift: vi.fn(),
  };

  it('renders the preferred-shifts hint text', () => {
    render(
      <MemoryRouter>
        <PreferredShiftsFields {...shiftsSectionBaseProps} />
      </MemoryRouter>
    );

    expect(
      screen.getByText('The generator will do its best to honor your preferences.')
    ).toBeInTheDocument();
  });

  it('renders the unavailable-shifts hint text', () => {
    render(
      <MemoryRouter>
        <UnavailableShiftsFields {...shiftsSectionBaseProps} />
      </MemoryRouter>
    );

    expect(screen.getByText('You will never be scheduled during these times.')).toBeInTheDocument();
  });
});
