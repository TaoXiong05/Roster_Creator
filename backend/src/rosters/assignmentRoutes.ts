import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../auth/middleware';
import { localScheduler, AssignmentContext } from '../scheduling/localScheduler';

export const assignmentRouter = Router();
assignmentRouter.use(requireAuth);

assignmentRouter.post('/:id/generate-assignments', async (req: AuthedRequest, res) => {
  const roster = await prisma.roster.findUnique({
    where: { id: req.params.id },
    include: {
      rosterShifts: { include: { shiftTemplate: true } },
      group: { include: { members: { include: { staff: { include: { preference: true } } } } } },
    },
  });
  if (!roster || roster.userId !== req.userId) {
    return res.status(404).json({ error: 'Roster not found' });
  }
  if (roster.status === 'generating') {
    return res.status(409).json({ error: 'Already generating assignments for this roster' });
  }

  const previousStatus = roster.status;
  await prisma.roster.update({ where: { id: roster.id }, data: { status: 'generating' } });

  try {
    const context: AssignmentContext = {
      hoursPerShift: roster.hoursPerShift ?? 8,
      shifts: roster.rosterShifts.map((rs) => ({
        rosterShiftId: rs.id,
        date: rs.date.toISOString().slice(0, 10),
        startTime: rs.shiftTemplate.startTime,
        endTime: rs.shiftTemplate.endTime,
        headcount: rs.headcount,
        responsibilityId: rs.responsibilityId,
        shiftTemplateId: rs.shiftTemplate.id,
      })),
      staff: roster.group.members.map((m) => ({
        staffId: m.staff.id,
        name: m.staff.name,
        responsibilityIds: m.staff.responsibilityIds,
        minHours: m.staff.preference?.minHours ?? 0,
        maxHours: m.staff.preference?.maxHours ?? 40,
        hoursPeriod: m.staff.preference?.hoursPeriod ?? 'weekly',
        hoursUnit: m.staff.preference?.hoursUnit ?? 'hours',
        preferredShifts:
          (m.staff.preference?.preferredShifts as { weekday: number; shiftTemplateId: string }[]) ?? [],
        unavailableShifts:
          (m.staff.preference?.unavailableShifts as { weekday: number; shiftTemplateId: string }[]) ?? [],
        unavailableDateRanges: (m.staff.preference?.unavailableDateRanges as { start: string; end: string }[]) ?? [],
      })),
    };

    const result = await localScheduler.assignShifts(context);

    const shiftIds = roster.rosterShifts.map((rs) => rs.id);
    const shiftIdSet = new Set(shiftIds);
    const knownStaffIds = new Set(roster.group.members.map((m) => m.staff.id));

    // Defensive filtering: keep only roster shifts and group members the
    // scheduler actually referenced, in case ids ever go stale between the
    // context build and this point.
    const cleaned = result.assignments
      .filter((a) => shiftIdSet.has(a.rosterShiftId))
      .map((a) => ({
        rosterShiftId: a.rosterShiftId,
        staffIds: a.staffIds.filter((id) => knownStaffIds.has(id)),
      }));

    const resultByShift = new Map(cleaned.map((a) => [a.rosterShiftId, a.staffIds]));

    const rows = roster.rosterShifts.flatMap((rs) => {
      const staffIds = resultByShift.get(rs.id) ?? [];
      const filled = staffIds
        .slice(0, rs.headcount)
        .map((staffId) => ({ rosterShiftId: rs.id, staffId, unfilledTag: null as string | null }));
      const unfilledCount = rs.headcount - filled.length;
      const unfilled = Array.from({ length: Math.max(unfilledCount, 0) }, () => ({
        rosterShiftId: rs.id,
        staffId: null as string | null,
        unfilledTag: null as string | null,
      }));
      return [...filled, ...unfilled];
    });

    const [, , updatedRoster] = await prisma.$transaction([
      prisma.assignment.deleteMany({ where: { rosterShiftId: { in: shiftIds } } }),
      prisma.assignment.createMany({ data: rows }),
      prisma.roster.update({ where: { id: roster.id }, data: { status: 'preview' } }),
    ]);

    const assignments = await prisma.assignment.findMany({
      where: { rosterShiftId: { in: shiftIds } },
      include: { staff: true },
    });

    return res.json({ assignments, status: updatedRoster.status });
  } catch (err) {
    await prisma.roster.update({ where: { id: roster.id }, data: { status: previousStatus } });
    return res.status(502).json({ error: err instanceof Error ? err.message : 'Scheduling failed' });
  }
});

assignmentRouter.put('/:id/assignments', async (req: AuthedRequest, res) => {
  const roster = await prisma.roster.findUnique({ where: { id: req.params.id } });
  if (!roster || roster.userId !== req.userId) {
    return res.status(404).json({ error: 'Roster not found' });
  }

  const { assignments } = req.body as {
    assignments?: { id: string; staffId: string | null; unfilledTag: string | null }[];
  };
  if (!assignments) {
    return res.status(400).json({ error: 'assignments is required' });
  }

  const rosterShifts = await prisma.rosterShift.findMany({
    where: { rosterId: req.params.id },
    select: { id: true, date: true },
  });
  const rosterShiftIds = new Set(rosterShifts.map((rs) => rs.id));
  // Guard against a missing/undefined date (defensive — should always be set on real rows) so a
  // shift we can't date-check is simply skipped by the conflict check below rather than throwing.
  const dateByRosterShiftId = new Map(
    rosterShifts.map((rs) => [rs.id, rs.date ? rs.date.toISOString().slice(0, 10) : null])
  );

  // Fetch every assignment currently belonging to this roster (not just the ones referenced in the
  // request) so we can both validate ownership of the requested ids and, below, compute the
  // resulting assignment set for the same-day conflict check without a second round trip.
  const rosterAssignments = await prisma.assignment.findMany({
    where: { rosterShiftId: { in: Array.from(rosterShiftIds) } },
  });
  const ownedAssignments = rosterAssignments.filter((a) => rosterShiftIds.has(a.rosterShiftId));
  const updateById = new Map(assignments.map((a) => [a.id, a]));
  const ownedIds = new Set(ownedAssignments.filter((a) => updateById.has(a.id)).map((a) => a.id));

  for (const a of assignments) {
    if (!ownedIds.has(a.id)) {
      return res.status(404).json({ error: `Assignment ${a.id} not found in this roster` });
    }
  }

  const staffIds = [...new Set(assignments.map((a) => a.staffId).filter((id): id is string => id !== null))];
  if (staffIds.length > 0) {
    const staff = await prisma.staff.findMany({ where: { id: { in: staffIds } } });
    const ownedStaffIds = new Set(staff.filter((s) => s.userId === req.userId).map((s) => s.id));
    for (const staffId of staffIds) {
      if (!ownedStaffIds.has(staffId)) {
        return res.status(404).json({ error: `Staff ${staffId} not found` });
      }
    }
  }

  // Enforce the "one shift per staff per day" hard rule (see localScheduler.isHardEligible) on
  // manual edits too: apply the requested updates on top of the roster's current assignment set
  // and reject if it would double-book a staff member on the same calendar date.
  const staffDayToAssignmentId = new Map<string, string>();
  for (const a of ownedAssignments) {
    const update = updateById.get(a.id);
    const resultingStaffId = update ? update.staffId : a.staffId;
    if (!resultingStaffId) continue;
    const date = dateByRosterShiftId.get(a.rosterShiftId);
    if (!date) continue;
    const key = `${resultingStaffId}::${date}`;
    const conflictingAssignmentId = staffDayToAssignmentId.get(key);
    if (conflictingAssignmentId && conflictingAssignmentId !== a.id) {
      return res.status(400).json({
        error: `Staff ${resultingStaffId} would be assigned to more than one shift on ${date}`,
      });
    }
    staffDayToAssignmentId.set(key, a.id);
  }

  await prisma.$transaction(
    assignments.map((a) =>
      prisma.assignment.update({
        where: { id: a.id },
        data: { staffId: a.staffId, unfilledTag: a.unfilledTag },
      })
    )
  );

  const updated = await prisma.assignment.findMany({
    where: { rosterShiftId: { in: Array.from(rosterShiftIds) } },
    include: { staff: true },
  });

  res.json({ assignments: updated });
});
