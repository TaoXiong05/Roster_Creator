import { describe, it, expect } from 'vitest';
import { localScheduler, AssignmentContext, AssignmentContextShift, AssignmentContextStaff } from '../localScheduler';

function makeShift(overrides: Partial<AssignmentContextShift> = {}): AssignmentContextShift {
  return {
    rosterShiftId: 'rs-1',
    date: '2026-08-24',
    startTime: '09:00',
    endTime: '17:00',
    headcount: 1,
    responsibilityId: 'resp-1',
    shiftTemplateId: 'template-1',
    ...overrides,
  };
}

function makeStaff(overrides: Partial<AssignmentContextStaff> = {}): AssignmentContextStaff {
  return {
    staffId: 'staff-1',
    name: 'Staff',
    responsibilityIds: ['resp-1'],
    minHours: 0,
    maxHours: 40,
    hoursPeriod: 'weekly',
    hoursUnit: 'hours',
    preferredShifts: [],
    unavailableShifts: [],
    unavailableDateRanges: [],
    ...overrides,
  };
}

function findShift(assignments: { rosterShiftId: string; staffIds: string[] }[], id: string) {
  return assignments.find((a) => a.rosterShiftId === id)!;
}

describe('localScheduler', () => {
  it('prefers a staff member whose responsibilities match the shift', async () => {
    const context: AssignmentContext = {
      hoursPerShift: 8,
      shifts: [makeShift({ headcount: 1 })],
      staff: [
        makeStaff({ staffId: 'staff-match', responsibilityIds: ['resp-1'] }),
        makeStaff({ staffId: 'staff-other', responsibilityIds: ['resp-2'] }),
      ],
    };

    const result = await localScheduler.assignShifts(context);

    expect(findShift(result.assignments, 'rs-1').staffIds).toEqual(['staff-match']);
  });

  it('falls back to a non-matching staff member rather than leaving a shift empty', async () => {
    const context: AssignmentContext = {
      hoursPerShift: 8,
      shifts: [makeShift({ headcount: 1 })],
      staff: [makeStaff({ staffId: 'staff-other', responsibilityIds: ['resp-2'] })],
    };

    const result = await localScheduler.assignShifts(context);

    expect(findShift(result.assignments, 'rs-1').staffIds).toEqual(['staff-other']);
  });

  it('never assigns a staff member on a date within their unavailableDateRanges', async () => {
    const context: AssignmentContext = {
      hoursPerShift: 8,
      shifts: [makeShift({ headcount: 1, date: '2026-08-24' })],
      staff: [
        makeStaff({ staffId: 'staff-away', unavailableDateRanges: [{ start: '2026-08-20', end: '2026-08-28' }] }),
        makeStaff({ staffId: 'staff-available' }),
      ],
    };

    const result = await localScheduler.assignShifts(context);

    expect(findShift(result.assignments, 'rs-1').staffIds).toEqual(['staff-available']);
  });

  it('leaves a shift unfilled rather than assigning an unavailable staff member', async () => {
    const context: AssignmentContext = {
      hoursPerShift: 8,
      shifts: [makeShift({ headcount: 1, date: '2026-08-24' })],
      staff: [makeStaff({ unavailableDateRanges: [{ start: '2026-08-20', end: '2026-08-28' }] })],
    };

    const result = await localScheduler.assignShifts(context);

    expect(findShift(result.assignments, 'rs-1').staffIds).toEqual([]);
  });

  it('prefers a staff member whose preferredShifts match this shift', async () => {
    const shift = makeShift({ date: '2026-08-24' });
    const weekday = new Date('2026-08-24T00:00:00Z').getUTCDay();
    const context: AssignmentContext = {
      hoursPerShift: 8,
      shifts: [shift],
      staff: [
        makeStaff({ staffId: 'staff-prefers', preferredShifts: [{ weekday, shiftTemplateId: shift.shiftTemplateId }] }),
        makeStaff({ staffId: 'staff-neutral' }),
      ],
    };

    const result = await localScheduler.assignShifts(context);

    expect(findShift(result.assignments, 'rs-1').staffIds).toEqual(['staff-prefers']);
  });

  it('avoids a staff member whose unavailableShifts match this shift when an alternative exists', async () => {
    const shift = makeShift({ date: '2026-08-24' });
    const weekday = new Date('2026-08-24T00:00:00Z').getUTCDay();
    const context: AssignmentContext = {
      hoursPerShift: 8,
      shifts: [shift],
      staff: [
        makeStaff({ staffId: 'staff-avoids', unavailableShifts: [{ weekday, shiftTemplateId: shift.shiftTemplateId }] }),
        makeStaff({ staffId: 'staff-neutral' }),
      ],
    };

    const result = await localScheduler.assignShifts(context);

    expect(findShift(result.assignments, 'rs-1').staffIds).toEqual(['staff-neutral']);
  });

  it('avoids putting the same person on a late shift followed by an early shift the next day', async () => {
    const shiftPrev = makeShift({
      rosterShiftId: 'rs-prev',
      date: '2026-08-24',
      startTime: '14:00',
      endTime: '22:00',
    });
    const shiftNext = makeShift({
      rosterShiftId: 'rs-next',
      date: '2026-08-25',
      startTime: '06:00',
      endTime: '14:00',
    });
    const context: AssignmentContext = {
      hoursPerShift: 8,
      shifts: [shiftPrev, shiftNext],
      staff: [makeStaff({ staffId: 'staff-a' }), makeStaff({ staffId: 'staff-b' })],
    };

    const result = await localScheduler.assignShifts(context);

    const prevStaff = findShift(result.assignments, 'rs-prev').staffIds[0];
    const nextStaff = findShift(result.assignments, 'rs-next').staffIds[0];
    expect(prevStaff).not.toBe(nextStaff);
  });

  it('avoids double-booking the same person on two shifts the same day when an alternative exists', async () => {
    const shiftMorning = makeShift({ rosterShiftId: 'rs-morning', date: '2026-08-24', startTime: '06:00', endTime: '10:00' });
    const shiftAfternoon = makeShift({
      rosterShiftId: 'rs-afternoon',
      date: '2026-08-24',
      startTime: '14:00',
      endTime: '18:00',
    });
    const context: AssignmentContext = {
      hoursPerShift: 4,
      shifts: [shiftMorning, shiftAfternoon],
      staff: [makeStaff({ staffId: 'staff-a' }), makeStaff({ staffId: 'staff-b' })],
    };

    const result = await localScheduler.assignShifts(context);

    const morningStaff = findShift(result.assignments, 'rs-morning').staffIds[0];
    const afternoonStaff = findShift(result.assignments, 'rs-afternoon').staffIds[0];
    expect(morningStaff).not.toBe(afternoonStaff);
  });

  it('distributes shifts so each staff member reaches their proportional minHours target', async () => {
    // 5 daily shifts spanning exactly one week; staff-b needs 3 of them (hoursUnit=shifts, minHours=3, weekly period).
    const shifts = ['2026-08-24', '2026-08-25', '2026-08-26', '2026-08-27', '2026-08-28'].map((date, i) =>
      makeShift({ rosterShiftId: `rs-${i}`, date })
    );
    const context: AssignmentContext = {
      hoursPerShift: 8,
      shifts,
      staff: [
        makeStaff({ staffId: 'staff-a', minHours: 0, hoursUnit: 'shifts' }),
        makeStaff({ staffId: 'staff-b', minHours: 3, hoursUnit: 'shifts', hoursPeriod: 'weekly' }),
      ],
    };

    const result = await localScheduler.assignShifts(context);

    const countFor = (staffId: string) =>
      result.assignments.filter((a) => a.staffIds.includes(staffId)).length;
    expect(countFor('staff-b')).toBeGreaterThanOrEqual(3);
  });

  it('keeps responsibility match as a higher priority than minHours shortfall', async () => {
    const context: AssignmentContext = {
      hoursPerShift: 8,
      shifts: [makeShift({ headcount: 1, responsibilityId: 'resp-1' })],
      staff: [
        makeStaff({ staffId: 'staff-qualified', responsibilityIds: ['resp-1'], minHours: 0 }),
        makeStaff({ staffId: 'staff-needs-hours', responsibilityIds: ['resp-2'], minHours: 40, hoursUnit: 'shifts' }),
      ],
    };

    const result = await localScheduler.assignShifts(context);

    expect(findShift(result.assignments, 'rs-1').staffIds).toEqual(['staff-qualified']);
  });

  it('caps the number of staff assigned to a shift at its headcount', async () => {
    const context: AssignmentContext = {
      hoursPerShift: 8,
      shifts: [makeShift({ headcount: 2 })],
      staff: [
        makeStaff({ staffId: 'staff-1' }),
        makeStaff({ staffId: 'staff-2' }),
        makeStaff({ staffId: 'staff-3' }),
      ],
    };

    const result = await localScheduler.assignShifts(context);

    const staffIds = findShift(result.assignments, 'rs-1').staffIds;
    expect(staffIds).toHaveLength(2);
    expect(new Set(staffIds).size).toBe(2);
  });

  it('is deterministic: the same input always produces the same output', async () => {
    const context: AssignmentContext = {
      hoursPerShift: 8,
      shifts: ['2026-08-24', '2026-08-25', '2026-08-26'].map((date, i) => makeShift({ rosterShiftId: `rs-${i}`, date })),
      staff: [
        makeStaff({ staffId: 'staff-a', minHours: 2, hoursUnit: 'shifts' }),
        makeStaff({ staffId: 'staff-b', minHours: 1, hoursUnit: 'shifts' }),
      ],
    };

    const [first, second] = await Promise.all([
      localScheduler.assignShifts(context),
      localScheduler.assignShifts(context),
    ]);

    expect(second).toEqual(first);
  });
});
