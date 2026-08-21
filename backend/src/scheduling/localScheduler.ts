export interface AssignmentContextShift {
  rosterShiftId: string;
  date: string;
  startTime: string;
  endTime: string;
  headcount: number;
  responsibilityId: string;
  shiftTemplateId: string;
}

export interface AssignmentContextStaff {
  staffId: string;
  name: string;
  responsibilityIds: string[];
  minHours: number;
  maxHours: number;
  hoursPeriod: string;
  hoursUnit: string;
  preferredShifts: { weekday: number; shiftTemplateId: string }[];
  unavailableShifts: { weekday: number; shiftTemplateId: string }[];
  unavailableDateRanges: { start: string; end: string }[];
}

export interface AssignmentContext {
  shifts: AssignmentContextShift[];
  staff: AssignmentContextStaff[];
  hoursPerShift: number;
}

export interface AssignmentResultEntry {
  rosterShiftId: string;
  staffIds: string[];
}

export interface AssignmentResult {
  assignments: AssignmentResultEntry[];
}

export interface SchedulingEngine {
  assignShifts(context: AssignmentContext): Promise<AssignmentResult>;
}

// Priority order (highest to lowest), mirroring the previous AI prompt's tiers:
// 1. responsibility match (basic rule: prefer a qualified staff member, fall back rather than leave a shift empty)
// 2. minHours target (hard tier: satisfy each staff member's minimum hours/shifts for this period)
// 3. shift preference (nice-to-have: honor preferredShifts / avoid unavailableShifts, respect maxHours)
// 4. 11-hour rest gap between consecutive-day shifts (nice-to-have, lower priority than preference)
// A staff member is never given a second shift on a day they already have one (hard rule — see
// isHardEligible), so daily-overtime-from-stacking and double-booking can no longer occur; a shift
// left uncovered because everyone eligible is already booked that day is the expected outcome.
const RESP_MATCH_BONUS = 5000;
const SHORTFALL_WEIGHT = 1000;
const PREFERRED_BONUS = 100;
const UNAVAILABLE_SHIFT_PENALTY = 100;
const MAX_HOURS_PENALTY = 100;
const REST_GAP_PENALTY = 50;

const REST_GAP_MIN_HOURS = 11;
const MAX_LOCAL_SEARCH_ITERATIONS = 300;

const PERIOD_DAYS: Record<string, number> = {
  weekly: 7,
  fortnightly: 14,
  monthly: 30,
};

function toMinutesOfDay(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function dateToMinutes(date: string): number {
  return Date.parse(`${date}T00:00:00Z`) / 60000;
}

function shiftDurationHours(shift: AssignmentContextShift): number {
  let start = toMinutesOfDay(shift.startTime);
  let end = toMinutesOfDay(shift.endTime);
  if (end <= start) end += 24 * 60; // overnight shift wraps past midnight
  return (end - start) / 60;
}

function shiftStartAbsoluteMinutes(shift: AssignmentContextShift): number {
  return dateToMinutes(shift.date) + toMinutesOfDay(shift.startTime);
}

function hasRestGapViolation(a: AssignmentContextShift, b: AssignmentContextShift): boolean {
  const aStart = shiftStartAbsoluteMinutes(a);
  const aEnd = aStart + shiftDurationHours(a) * 60;
  const bStart = shiftStartAbsoluteMinutes(b);
  const bEnd = bStart + shiftDurationHours(b) * 60;
  if (aEnd <= bStart) return bStart - aEnd < REST_GAP_MIN_HOURS * 60;
  if (bEnd <= aStart) return aStart - bEnd < REST_GAP_MIN_HOURS * 60;
  return false; // shifts on the same day never co-occur for one staff member (see isHardEligible)
}

function dateWeekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

function isUnavailableOnDate(staff: AssignmentContextStaff, date: string): boolean {
  return staff.unavailableDateRanges.some((r) => date >= r.start && date <= r.end);
}

function matchesShiftRule(
  rule: { weekday: number; shiftTemplateId: string },
  shift: AssignmentContextShift,
  weekday: number
): boolean {
  return rule.weekday === weekday && rule.shiftTemplateId === shift.shiftTemplateId;
}

function computeRosterDays(shifts: AssignmentContextShift[]): number {
  if (shifts.length === 0) return 0;
  const dates = shifts.map((s) => s.date).sort();
  const min = dates[0];
  const max = dates[dates.length - 1];
  return (Date.parse(`${max}T00:00:00Z`) - Date.parse(`${min}T00:00:00Z`)) / 86_400_000 + 1;
}

function computeTargetUnits(staff: AssignmentContextStaff, rosterDays: number): number {
  if (rosterDays <= 0) return 0;
  const periodDays = PERIOD_DAYS[staff.hoursPeriod] ?? PERIOD_DAYS.weekly;
  return staff.minHours * (rosterDays / periodDays);
}

interface Move {
  shiftId: string;
  from: string;
  to: string;
  delta: number;
}

function runLocalScheduler(context: AssignmentContext): AssignmentResultEntry[] {
  const { shifts, staff, hoursPerShift } = context;
  const staffById = new Map(staff.map((s) => [s.staffId, s]));
  const shiftById = new Map(shifts.map((s) => [s.rosterShiftId, s]));

  const rosterDays = computeRosterDays(shifts);
  const targetByStaff = new Map(staff.map((s) => [s.staffId, computeTargetUnits(s, rosterDays)]));

  const assignedByShift = new Map<string, string[]>(shifts.map((s) => [s.rosterShiftId, []]));
  const assignedByStaff = new Map<string, Set<string>>(staff.map((s) => [s.staffId, new Set<string>()]));

  const unitDelta = (s: AssignmentContextStaff) => (s.hoursUnit === 'shifts' ? 1 : hoursPerShift);

  function otherAssignedShifts(staffId: string, excludeShiftId: string): AssignmentContextShift[] {
    const ids = assignedByStaff.get(staffId)!;
    const result: AssignmentContextShift[] = [];
    for (const id of ids) {
      if (id === excludeShiftId) continue;
      const shift = shiftById.get(id);
      if (shift) result.push(shift);
    }
    return result;
  }

  function isHardEligible(staffId: string, shift: AssignmentContextShift): boolean {
    if (isUnavailableOnDate(staffById.get(staffId)!, shift.date)) return false;
    // A staff member can work at most one shift per day — this also covers the narrower case of
    // holding only one role within the same shift occurrence (same date + shiftTemplateId), since
    // that's a subset of "another shift the same date".
    const others = otherAssignedShifts(staffId, shift.rosterShiftId);
    if (others.some((o) => o.date === shift.date)) return false;
    return true;
  }

  // Marginal score of having `staffId` on `shift`, given their other current assignments
  // (excluding `shift` itself, so it works both for "would gain this shift" and "currently holds it").
  function marginalScore(staffId: string, shift: AssignmentContextShift): number {
    const s = staffById.get(staffId)!;
    const others = otherAssignedShifts(staffId, shift.rosterShiftId);
    const delta = unitDelta(s);
    const before = others.length * delta;
    const after = before + delta;
    const target = targetByStaff.get(staffId) ?? 0;
    const shortfallBefore = Math.max(0, target - before);
    const shortfallAfter = Math.max(0, target - after);
    const shortfallScore = target > 0 ? ((shortfallBefore - shortfallAfter) / target) * SHORTFALL_WEIGHT : 0;

    let score = shortfallScore;
    if (s.responsibilityIds.includes(shift.responsibilityId)) score += RESP_MATCH_BONUS;

    const weekday = dateWeekday(shift.date);
    if (s.preferredShifts.some((r) => matchesShiftRule(r, shift, weekday))) score += PREFERRED_BONUS;
    if (s.unavailableShifts.some((r) => matchesShiftRule(r, shift, weekday))) score -= UNAVAILABLE_SHIFT_PENALTY;
    if (after > s.maxHours) score -= MAX_HOURS_PENALTY;

    for (const other of others) {
      if (hasRestGapViolation(other, shift)) score -= REST_GAP_PENALTY;
    }

    return score;
  }

  function scarcity(shift: AssignmentContextShift): number {
    const eligible = staff.filter((s) => isHardEligible(s.staffId, shift));
    if (eligible.length === 0) return -Infinity;
    // Prefer counting only responsibility-qualified candidates: a shift with many hard-eligible
    // staff but only one who actually matches its responsibility is more urgent to fill than the
    // raw eligible count suggests (e.g. one generalist plus one specialist covering two roles in
    // the same shift occurrence — the specialist-only role must be greedily filled first, since a
    // single-role-per-slot hard constraint can't be undone by the later local-search swap pass).
    // Fall back to the raw eligible count when nobody is qualified, so the existing "fill from a
    // non-matching candidate rather than leave the shift empty" behavior is unaffected.
    const qualified = eligible.filter((s) => s.responsibilityIds.includes(shift.responsibilityId));
    const count = qualified.length > 0 ? qualified.length : eligible.length;
    return count / Math.max(shift.headcount, 1);
  }

  // --- Phase 1: greedy fill, most-constrained shifts first ---
  const shiftFillOrder = [...shifts].sort(
    (a, b) => scarcity(a) - scarcity(b) || a.rosterShiftId.localeCompare(b.rosterShiftId)
  );

  for (const shift of shiftFillOrder) {
    const slots = assignedByShift.get(shift.rosterShiftId)!;
    while (slots.length < shift.headcount) {
      let best: string | null = null;
      let bestScore = -Infinity;
      for (const s of staff) {
        if (slots.includes(s.staffId)) continue;
        if (!isHardEligible(s.staffId, shift)) continue;
        const score = marginalScore(s.staffId, shift);
        if (best === null || score > bestScore || (score === bestScore && s.staffId < best)) {
          bestScore = score;
          best = s.staffId;
        }
      }
      if (best === null) break; // no eligible candidate left; leave this slot unfilled
      slots.push(best);
      assignedByStaff.get(best)!.add(shift.rosterShiftId);
    }
  }

  // --- Phase 2: deterministic local search (steepest-ascent hill climbing) ---
  const maxIterations = Math.min(MAX_LOCAL_SEARCH_ITERATIONS, shifts.length * staff.length);
  for (let iter = 0; iter < maxIterations; iter++) {
    let bestMove: Move | null = null;

    for (const shift of shifts) {
      const slots = assignedByShift.get(shift.rosterShiftId)!;
      for (const from of slots) {
        const currentScore = marginalScore(from, shift);
        for (const candidate of staff) {
          if (candidate.staffId === from || slots.includes(candidate.staffId)) continue;
          if (!isHardEligible(candidate.staffId, shift)) continue;
          const delta = marginalScore(candidate.staffId, shift) - currentScore;
          if (delta <= 1e-9) continue;
          if (
            !bestMove ||
            delta > bestMove.delta + 1e-9 ||
            (Math.abs(delta - bestMove.delta) <= 1e-9 &&
              (shift.rosterShiftId < bestMove.shiftId ||
                (shift.rosterShiftId === bestMove.shiftId &&
                  (from < bestMove.from || (from === bestMove.from && candidate.staffId < bestMove.to)))))
          ) {
            bestMove = { shiftId: shift.rosterShiftId, from, to: candidate.staffId, delta };
          }
        }
      }
    }

    if (!bestMove) break;
    const slots = assignedByShift.get(bestMove.shiftId)!;
    slots[slots.indexOf(bestMove.from)] = bestMove.to;
    assignedByStaff.get(bestMove.from)!.delete(bestMove.shiftId);
    assignedByStaff.get(bestMove.to)!.add(bestMove.shiftId);
  }

  return shifts.map((shift) => ({
    rosterShiftId: shift.rosterShiftId,
    staffIds: assignedByShift.get(shift.rosterShiftId) ?? [],
  }));
}

export const localScheduler: SchedulingEngine = {
  async assignShifts(context: AssignmentContext): Promise<AssignmentResult> {
    return { assignments: runLocalScheduler(context) };
  },
};
