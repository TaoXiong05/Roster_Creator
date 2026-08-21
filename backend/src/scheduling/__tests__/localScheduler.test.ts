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

  it('never assigns the same person to two different-time shifts the same day, even with staff to spare', async () => {
    const shiftMorning = makeShift({
      rosterShiftId: 'rs-morning',
      date: '2026-08-24',
      startTime: '06:00',
      endTime: '10:00',
      shiftTemplateId: 'template-morning',
    });
    const shiftAfternoon = makeShift({
      rosterShiftId: 'rs-afternoon',
      date: '2026-08-24',
      startTime: '14:00',
      endTime: '18:00',
      shiftTemplateId: 'template-afternoon',
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

  it('leaves a shift unfilled rather than double-booking the only staff member available that day', async () => {
    const shiftMorning = makeShift({
      rosterShiftId: 'rs-morning',
      date: '2026-08-24',
      startTime: '06:00',
      endTime: '10:00',
      shiftTemplateId: 'template-morning',
    });
    const shiftAfternoon = makeShift({
      rosterShiftId: 'rs-afternoon',
      date: '2026-08-24',
      startTime: '14:00',
      endTime: '18:00',
      shiftTemplateId: 'template-afternoon',
    });
    const context: AssignmentContext = {
      hoursPerShift: 4,
      shifts: [shiftMorning, shiftAfternoon],
      staff: [makeStaff({ staffId: 'staff-only' })],
    };

    const result = await localScheduler.assignShifts(context);

    const morningStaff = findShift(result.assignments, 'rs-morning').staffIds;
    const afternoonStaff = findShift(result.assignments, 'rs-afternoon').staffIds;
    // staff-only can cover exactly one of the two same-day shifts; the other is left unfilled
    // rather than double-booking them.
    expect(morningStaff.length + afternoonStaff.length).toBe(1);
  });

  it('never assigns the same staff member to two roles within the same shift occurrence', async () => {
    // Same date + shiftTemplateId = the same physical shift, split into two role requirements.
    const roleA = makeShift({ rosterShiftId: 'rs-role-a', responsibilityId: 'resp-a' });
    const roleB = makeShift({ rosterShiftId: 'rs-role-b', responsibilityId: 'resp-b' });
    const context: AssignmentContext = {
      hoursPerShift: 8,
      shifts: [roleA, roleB],
      staff: [makeStaff({ staffId: 'staff-multi', responsibilityIds: ['resp-a', 'resp-b'] })],
    };

    const result = await localScheduler.assignShifts(context);

    const roleAStaff = findShift(result.assignments, 'rs-role-a').staffIds;
    const roleBStaff = findShift(result.assignments, 'rs-role-b').staffIds;
    // Only one of the two roles can be filled by the single available person; the other stays open.
    expect(roleAStaff.length + roleBStaff.length).toBe(1);
  });

  it('gives the scarce role to the specialist and the flexible role to the generalist', async () => {
    const roleA = makeShift({ rosterShiftId: 'rs-role-a', responsibilityId: 'resp-a' });
    const roleB = makeShift({ rosterShiftId: 'rs-role-b', responsibilityId: 'resp-b' });
    const context: AssignmentContext = {
      hoursPerShift: 8,
      shifts: [roleA, roleB],
      staff: [
        makeStaff({ staffId: 'staff-multi', responsibilityIds: ['resp-a', 'resp-b'] }),
        makeStaff({ staffId: 'staff-single', responsibilityIds: ['resp-a'] }),
      ],
    };

    const result = await localScheduler.assignShifts(context);

    // staff-single can only ever cover role A, so role B (only staff-multi qualifies) must go to
    // staff-multi, freeing staff-single for role A — both roles end up filled.
    expect(findShift(result.assignments, 'rs-role-b').staffIds).toEqual(['staff-multi']);
    expect(findShift(result.assignments, 'rs-role-a').staffIds).toEqual(['staff-single']);
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

  it('prioritizes reaching minHours over responsibility match when someone is far below target', async () => {
    // staff-needs-hours is far below their proportional minHours for this single-shift roster, so
    // they must be fed a shift first even though the responsibility match belongs to staff-qualified.
    const context: AssignmentContext = {
      hoursPerShift: 8,
      shifts: [makeShift({ headcount: 1, responsibilityId: 'resp-1' })],
      staff: [
        makeStaff({ staffId: 'staff-qualified', responsibilityIds: ['resp-1'], minHours: 0 }),
        makeStaff({
          staffId: 'staff-needs-hours',
          responsibilityIds: ['resp-2'],
          minHours: 40,
          hoursUnit: 'shifts',
        }),
      ],
    };

    const result = await localScheduler.assignShifts(context);

    expect(findShift(result.assignments, 'rs-1').staffIds).toEqual(['staff-needs-hours']);
  });

  it('never assigns the same staff member more shifts than their maxHours allows', async () => {
    const context: AssignmentContext = {
      hoursPerShift: 8,
      shifts: [
        makeShift({ rosterShiftId: 'rs-a', date: '2026-08-24' }),
        makeShift({ rosterShiftId: 'rs-b', date: '2026-08-25' }),
      ],
      staff: [
        makeStaff({ staffId: 'staff-only', maxHours: 1, hoursUnit: 'shifts' }),
      ],
    };

    const result = await localScheduler.assignShifts(context);

    // staff-only can take exactly one shift; the second is left unfilled rather than violating maxHours.
    expect(findShift(result.assignments, 'rs-b').staffIds).toEqual([]);
  });

  it('scales maxHours up to match minHours when the roster spans more than one hoursPeriod', async () => {
    // fortnightly minHours=6/maxHours=8 (shifts) on a 30-day roster: the proportional minHours
    // target for the whole roster is ~12.86 shifts, so maxHours must scale by the same ratio
    // (~2.14x -> ~17.1) or the raw cap of 8 makes that target impossible to reach.
    const start = new Date('2026-08-01T00:00:00Z');
    const shifts = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      return makeShift({ rosterShiftId: `rs-${i}`, date: d.toISOString().slice(0, 10) });
    });
    const context: AssignmentContext = {
      hoursPerShift: 8,
      shifts,
      staff: [
        makeStaff({
          staffId: 'staff-fortnight',
          minHours: 6,
          maxHours: 8,
          hoursPeriod: 'fortnightly',
          hoursUnit: 'shifts',
        }),
        makeStaff({ staffId: 'staff-filler' }),
      ],
    };

    const result = await localScheduler.assignShifts(context);

    const fortnightCount = result.assignments.filter((a) => a.staffIds.includes('staff-fortnight')).length;
    expect(fortnightCount).toBeGreaterThan(8);
  });

  it('leaves a shift unfilled when its only candidates have that shift marked unavailable', async () => {
    const shift = makeShift({ date: '2026-08-24' });
    const weekday = new Date('2026-08-24T00:00:00Z').getUTCDay();
    const context: AssignmentContext = {
      hoursPerShift: 8,
      shifts: [shift],
      staff: [
        makeStaff({
          staffId: 'staff-avoids',
          unavailableShifts: [{ weekday, shiftTemplateId: shift.shiftTemplateId }],
        }),
      ],
    };

    const result = await localScheduler.assignShifts(context);

    expect(findShift(result.assignments, 'rs-1').staffIds).toEqual([]);
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
