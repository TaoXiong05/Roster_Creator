import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../auth/middleware';
import { aiProvider, AssignmentContext } from '../ai/provider';

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

  const context: AssignmentContext = {
    hoursPerShift: roster.hoursPerShift ?? 8,
    shifts: roster.rosterShifts.map((rs) => ({
      rosterShiftId: rs.id,
      date: rs.date.toISOString().slice(0, 10),
      startTime: rs.shiftTemplate.startTime,
      endTime: rs.shiftTemplate.endTime,
      headcount: rs.headcount,
      responsibilityId: rs.responsibilityId,
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

  let result;
  try {
    result = await aiProvider.assignShifts(context);
  } catch (err) {
    return res.status(502).json({ error: err instanceof Error ? err.message : 'AI provider failed' });
  }

  const shiftIds = roster.rosterShifts.map((rs) => rs.id);
  const shiftIdSet = new Set(shiftIds);
  const knownStaffIds = new Set(roster.group.members.map((m) => m.staff.id));

  for (const a of result.assignments) {
    if (!shiftIdSet.has(a.rosterShiftId)) {
      return res.status(502).json({ error: 'AI provider referenced a roster shift that does not exist' });
    }
    for (const staffId of a.staffIds) {
      if (!knownStaffIds.has(staffId)) {
        return res.status(502).json({ error: 'AI provider referenced a staff member that does not exist' });
      }
    }
  }

  const resultByShift = new Map(result.assignments.map((a) => [a.rosterShiftId, a.staffIds]));

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

  await prisma.$transaction([
    prisma.assignment.deleteMany({ where: { rosterShiftId: { in: shiftIds } } }),
    prisma.assignment.createMany({ data: rows }),
  ]);

  const assignments = await prisma.assignment.findMany({
    where: { rosterShiftId: { in: shiftIds } },
    include: { staff: true },
  });

  res.json({ assignments });
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
    select: { id: true },
  });
  const rosterShiftIds = new Set(rosterShifts.map((rs) => rs.id));

  const existing = await prisma.assignment.findMany({ where: { id: { in: assignments.map((a) => a.id) } } });
  const ownedIds = new Set(existing.filter((a) => rosterShiftIds.has(a.rosterShiftId)).map((a) => a.id));

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

  await Promise.all(
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
