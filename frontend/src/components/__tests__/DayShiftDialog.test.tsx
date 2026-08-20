import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DayShiftDialog, DayShiftRow } from '../DayShiftDialog';

const templates = [
  { id: 'template-1', name: 'Morning', startTime: '06:00', endTime: '14:00' },
  { id: 'template-2', name: 'Evening', startTime: '14:00', endTime: '22:00' },
];

const responsibilities = [
  { id: 'resp-1', name: 'Cashier' },
  { id: 'resp-2', name: 'Cleaning' },
  { id: 'resp-3', name: 'Supervisor' },
];

const baseProps = {
  open: true,
  date: '2026-08-17',
  templates,
  responsibilities,
  onAddRow: vi.fn(),
  onRemoveRow: vi.fn(),
  onAddRequirement: vi.fn(),
  onRemoveRequirement: vi.fn(),
  onRequirementChange: vi.fn(),
  onClose: vi.fn(),
};

function optionValues(select: HTMLElement): string[] {
  return Array.from(select.querySelectorAll('option')).map((o) => (o as HTMLOptionElement).value);
}

describe('DayShiftDialog', () => {
  it('excludes a role already chosen by a sibling requirement in the same row, but keeps it in its own dropdown', () => {
    const rows: DayShiftRow[] = [
      {
        shiftTemplateId: 'template-1',
        requirements: [
          { responsibilityId: 'resp-1', headcount: 2 },
          { responsibilityId: '', headcount: 1 },
        ],
      },
    ];

    render(
      <MemoryRouter>
        <DayShiftDialog {...baseProps} rows={rows} />
      </MemoryRouter>
    );

    const req1Select = screen.getByLabelText('Morning role 1');
    const req2Select = screen.getByLabelText('Morning role 2');

    // Requirement 1 still shows its own selected role (resp-1) as an option.
    expect(optionValues(req1Select)).toEqual(expect.arrayContaining(['resp-1']));
    // Requirement 2 must NOT offer resp-1 since it's already used by requirement 1.
    expect(optionValues(req2Select)).not.toContain('resp-1');
    // Requirement 2 still offers the other, unused roles.
    expect(optionValues(req2Select)).toEqual(expect.arrayContaining(['resp-2', 'resp-3']));
  });

  it('does not let a different row\'s chosen role affect this row\'s available options', () => {
    const rows: DayShiftRow[] = [
      {
        shiftTemplateId: 'template-1',
        requirements: [{ responsibilityId: 'resp-1', headcount: 2 }],
      },
      {
        shiftTemplateId: 'template-2',
        requirements: [{ responsibilityId: '', headcount: 1 }],
      },
    ];

    render(
      <MemoryRouter>
        <DayShiftDialog {...baseProps} rows={rows} />
      </MemoryRouter>
    );

    const eveningSelect = screen.getByLabelText('Evening role 1');
    // resp-1 was chosen in the Morning row, but should still be selectable in the Evening row.
    expect(optionValues(eveningSelect)).toEqual(expect.arrayContaining(['resp-1', 'resp-2', 'resp-3']));
  });

  it('re-adds a role to the sibling dropdown once it is cleared', () => {
    const rowsBefore: DayShiftRow[] = [
      {
        shiftTemplateId: 'template-1',
        requirements: [
          { responsibilityId: 'resp-1', headcount: 2 },
          { responsibilityId: '', headcount: 1 },
        ],
      },
    ];

    const { rerender } = render(
      <MemoryRouter>
        <DayShiftDialog {...baseProps} rows={rowsBefore} />
      </MemoryRouter>
    );

    expect(optionValues(screen.getByLabelText('Morning role 2'))).not.toContain('resp-1');

    const rowsAfter: DayShiftRow[] = [
      {
        shiftTemplateId: 'template-1',
        requirements: [
          { responsibilityId: '', headcount: 2 },
          { responsibilityId: '', headcount: 1 },
        ],
      },
    ];

    rerender(
      <MemoryRouter>
        <DayShiftDialog {...baseProps} rows={rowsAfter} />
      </MemoryRouter>
    );

    expect(optionValues(screen.getByLabelText('Morning role 2'))).toContain('resp-1');
  });
});
