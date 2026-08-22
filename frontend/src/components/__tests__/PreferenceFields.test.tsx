import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PreferredShiftsFields, UnavailableShiftsFields, validateHoursRange } from '../PreferenceFields';
import { translate } from '../../i18n/LanguageContext';

const templates = [
  { id: 'template-1', name: 'Morning', startTime: '06:00', endTime: '14:00' },
  { id: 'template-2', name: 'Evening', startTime: '14:00', endTime: '22:00' },
];

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
