import { randomUUID } from 'crypto';
import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../auth/middleware';

export const rosterRouter = Router();
rosterRouter.use(requireAuth);

interface ShiftRequirement {
  responsibilityId: string;
  headcount: number;
}

interface ShiftInput {
  shiftTemplateId: string;
  dates: string[];
  requirements: ShiftRequirement[];
}

rosterRouter.get('/', async (req: AuthedRequest, res) => {
  const rosters = await prisma.roster.findMany({
    where: { userId: req.userId },
    include: { _count: { select: { rosterShifts: true } }, group: true },
    orderBy: { dateRangeStart: 'desc' },
  });
  res.json(
    rosters.map((r) => ({
      id: r.id,
      name: r.name,
      dateRangeStart: r.dateRangeStart,
      dateRangeEnd: r.dateRangeEnd,
      groupId: r.groupId,
      groupName: r.group.name,
      status: r.status,
      shiftCount: r._count.rosterShifts,
    }))
  );
});

rosterRouter.get('/:id', async (req: AuthedRequest, res) => {
  const roster = await prisma.roster.findUnique({
    where: { id: req.params.id },
    include: {
      rosterShifts: {
        include: { shiftTemplate: true, assignments: { include: { staff: true } } },
        orderBy: { date: 'asc' },
      },
      group: true,
    },
  });
  if (!roster || roster.userId !== req.userId) {
    return res.status(404).json({ error: 'Roster not found' });
  }
  res.json(roster);
});

rosterRouter.post('/', async (req: AuthedRequest, res) => {
  const { name, dateRangeStart, dateRangeEnd, groupId, shifts, hoursPerShift } = req.body as {
    name?: string;
    dateRangeStart?: string;
    dateRangeEnd?: string;
    groupId?: string;
    shifts?: ShiftInput[];
    hoursPerShift?: number;
  };

  if (!name || !dateRangeStart || !dateRangeEnd || !groupId) {
    return res.status(400).json({ error: 'name, dateRangeStart, dateRangeEnd and groupId are required' });
  }
  if (!shifts || shifts.length === 0) {
    return res.status(400).json({ error: 'At least one shift is required' });
  }
  if (hoursPerShift !== undefined && hoursPerShift <= 0) {
    return res.status(400).json({ error: 'hoursPerShift must be greater than 0' });
  }
  const rangeStart = new Date(dateRangeStart);
  const rangeEnd = new Date(dateRangeEnd);
  if (rangeStart > rangeEnd) {
    return res.status(400).json({ error: 'dateRangeStart must not be after dateRangeEnd' });
  }
  for (const shift of shifts) {
    for (const date of shift.dates ?? []) {
      const d = new Date(date);
      if (d < rangeStart || d > rangeEnd) {
        return res.status(400).json({ error: `Date ${date} is outside the roster's date range` });
      }
    }
  }

  const group = await prisma.staffGroup.findUnique({ where: { id: groupId } });
  if (!group || group.userId !== req.userId) {
    return res.status(404).json({ error: 'Group not found' });
  }

  const templateIds = [...new Set(shifts.map((s) => s.shiftTemplateId))];
  const templates = await prisma.shiftTemplate.findMany({ where: { id: { in: templateIds } } });
  const ownedTemplateIds = new Set(templates.filter((t) => t.userId === req.userId).map((t) => t.id));

  for (const shift of shifts) {
    if (!ownedTemplateIds.has(shift.shiftTemplateId)) {
      return res.status(404).json({ error: `Shift template ${shift.shiftTemplateId} not found` });
    }
    if (!shift.dates || shift.dates.length === 0) {
      return res.status(400).json({ error: 'Each shift needs at least one date' });
    }
    if (!shift.requirements || shift.requirements.length === 0) {
      return res.status(400).json({ error: 'Each shift needs at least one responsibility requirement' });
    }
    for (const req of shift.requirements) {
      if (!req.responsibilityId) {
        return res.status(400).json({ error: 'responsibilityId is required for each requirement' });
      }
      if (!req.headcount || req.headcount < 1) {
        return res.status(400).json({ error: 'headcount must be at least 1' });
      }
    }
  }

  const roster = await prisma.$transaction(async (tx) => {
    const created = await tx.roster.create({
      data: {
        userId: req.userId!,
        name,
        dateRangeStart: new Date(dateRangeStart),
        dateRangeEnd: new Date(dateRangeEnd),
        groupId,
        hoursPerShift: hoursPerShift ?? 8,
      },
    });

    const rosterShiftRows = shifts.flatMap((shift) =>
      shift.dates.flatMap((date) =>
        shift.requirements.map((requirement) => ({
          id: randomUUID(),
          rosterId: created.id,
          shiftTemplateId: shift.shiftTemplateId,
          date: new Date(date),
          headcount: requirement.headcount,
          responsibilityId: requirement.responsibilityId,
        }))
      )
    );
    if (rosterShiftRows.length > 0) {
      await tx.rosterShift.createMany({ data: rosterShiftRows });
      await tx.assignment.createMany({
        data: rosterShiftRows.flatMap((rs) =>
          Array.from({ length: rs.headcount }, () => ({ rosterShiftId: rs.id, staffId: null, unfilledTag: null }))
        ),
      });
    }
    return { ...created, rosterShifts: rosterShiftRows };
  });

  res.status(201).json(roster);
});

rosterRouter.put('/:id', async (req: AuthedRequest, res) => {
  const existing = await prisma.roster.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.userId !== req.userId) {
    return res.status(404).json({ error: 'Roster not found' });
  }
  if (existing.status === 'generating') {
    return res.status(409).json({ error: 'Cannot edit a roster while it is generating' });
  }

  const { name, dateRangeStart, dateRangeEnd, groupId, shifts, hoursPerShift } = req.body as {
    name?: string;
    dateRangeStart?: string;
    dateRangeEnd?: string;
    groupId?: string;
    shifts?: ShiftInput[];
    hoursPerShift?: number;
  };

  if (!name || !dateRangeStart || !dateRangeEnd || !groupId) {
    return res.status(400).json({ error: 'name, dateRangeStart, dateRangeEnd and groupId are required' });
  }
  if (!shifts || shifts.length === 0) {
    return res.status(400).json({ error: 'At least one shift is required' });
  }
  if (hoursPerShift !== undefined && hoursPerShift <= 0) {
    return res.status(400).json({ error: 'hoursPerShift must be greater than 0' });
  }
  const rangeStart = new Date(dateRangeStart);
  const rangeEnd = new Date(dateRangeEnd);
  if (rangeStart > rangeEnd) {
    return res.status(400).json({ error: 'dateRangeStart must not be after dateRangeEnd' });
  }
  for (const shift of shifts) {
    for (const date of shift.dates ?? []) {
      const d = new Date(date);
      if (d < rangeStart || d > rangeEnd) {
        return res.status(400).json({ error: `Date ${date} is outside the roster's date range` });
      }
    }
  }

  const group = await prisma.staffGroup.findUnique({ where: { id: groupId } });
  if (!group || group.userId !== req.userId) {
    return res.status(404).json({ error: 'Group not found' });
  }

  const templateIds = [...new Set(shifts.map((s) => s.shiftTemplateId))];
  const templates = await prisma.shiftTemplate.findMany({ where: { id: { in: templateIds } } });
  const ownedTemplateIds = new Set(templates.filter((t) => t.userId === req.userId).map((t) => t.id));

  for (const shift of shifts) {
    if (!ownedTemplateIds.has(shift.shiftTemplateId)) {
      return res.status(404).json({ error: `Shift template ${shift.shiftTemplateId} not found` });
    }
    if (!shift.dates || shift.dates.length === 0) {
      return res.status(400).json({ error: 'Each shift needs at least one date' });
    }
    if (!shift.requirements || shift.requirements.length === 0) {
      return res.status(400).json({ error: 'Each shift needs at least one responsibility requirement' });
    }
    for (const req of shift.requirements) {
      if (!req.responsibilityId) {
        return res.status(400).json({ error: 'responsibilityId is required for each requirement' });
      }
      if (!req.headcount || req.headcount < 1) {
        return res.status(400).json({ error: 'headcount must be at least 1' });
      }
    }
  }

  // A RosterShift is identified by (shiftTemplateId, date, responsibilityId). Rows whose identity
  // is unchanged keep their id and existing assignments (so staffing survives an unrelated edit);
  // only rows that were actually added, removed, or resized touch the database.
  const shiftKey = (shiftTemplateId: string, date: string, responsibilityId: string) =>
    `${shiftTemplateId}|${date}|${responsibilityId}`;

  const updated = await prisma.$transaction(async (tx) => {
    const roster = await tx.roster.update({
      where: { id: existing.id },
      data: {
        name,
        dateRangeStart: new Date(dateRangeStart),
        dateRangeEnd: new Date(dateRangeEnd),
        groupId,
        hoursPerShift: hoursPerShift ?? existing.hoursPerShift,
        status: 'draft',
      },
    });

    const existingShifts = await tx.rosterShift.findMany({
      where: { rosterId: existing.id },
      include: { assignments: { select: { id: true, staffId: true } } },
    });

    const existingByKey = new Map<string, typeof existingShifts>();
    for (const rs of existingShifts) {
      const key = shiftKey(rs.shiftTemplateId, rs.date.toISOString().slice(0, 10), rs.responsibilityId);
      const list = existingByKey.get(key) ?? [];
      list.push(rs);
      existingByKey.set(key, list);
    }

    const desiredByKey = new Map<
      string,
      { shiftTemplateId: string; date: string; responsibilityId: string; headcount: number }[]
    >();
    for (const shift of shifts) {
      for (const date of shift.dates) {
        // Normalize to YYYY-MM-DD so the key matches existing rows' normalization below,
        // even if the client sends a full ISO timestamp instead of a bare date string.
        const normalizedDate = new Date(date).toISOString().slice(0, 10);
        for (const requirement of shift.requirements) {
          const key = shiftKey(shift.shiftTemplateId, normalizedDate, requirement.responsibilityId);
          const list = desiredByKey.get(key) ?? [];
          list.push({
            shiftTemplateId: shift.shiftTemplateId,
            date: normalizedDate,
            responsibilityId: requirement.responsibilityId,
            headcount: requirement.headcount,
          });
          desiredByKey.set(key, list);
        }
      }
    }

    const rosterShiftIdsToDelete: string[] = [];
    const headcountUpdates: { id: string; headcount: number }[] = [];
    const assignmentIdsToDelete: string[] = [];
    const assignmentRowsToAdd: { rosterShiftId: string; staffId: null; unfilledTag: null }[] = [];
    const newRosterShiftRows: {
      id: string;
      rosterId: string;
      shiftTemplateId: string;
      date: Date;
      headcount: number;
      responsibilityId: string;
    }[] = [];
    const newAssignmentRows: { rosterShiftId: string; staffId: null; unfilledTag: null }[] = [];

    for (const key of new Set([...existingByKey.keys(), ...desiredByKey.keys()])) {
      const existingList = existingByKey.get(key) ?? [];
      const desiredList = desiredByKey.get(key) ?? [];
      const pairCount = Math.min(existingList.length, desiredList.length);

      for (let i = 0; i < pairCount; i++) {
        const existingRow = existingList[i];
        const desiredRow = desiredList[i];
        if (existingRow.headcount !== desiredRow.headcount) {
          headcountUpdates.push({ id: existingRow.id, headcount: desiredRow.headcount });
        }
        const currentSlots = existingRow.assignments.length;
        if (desiredRow.headcount > currentSlots) {
          for (let j = 0; j < desiredRow.headcount - currentSlots; j++) {
            assignmentRowsToAdd.push({ rosterShiftId: existingRow.id, staffId: null, unfilledTag: null });
          }
        } else if (desiredRow.headcount < currentSlots) {
          // Free unfilled slots first so shrinking headcount doesn't discard a staff assignment
          // unless there aren't enough empty slots left to make up the difference.
          const removable = [...existingRow.assignments].sort((a, b) => (a.staffId ? 1 : 0) - (b.staffId ? 1 : 0));
          for (let j = 0; j < currentSlots - desiredRow.headcount; j++) {
            assignmentIdsToDelete.push(removable[j].id);
          }
        }
      }

      for (let i = pairCount; i < existingList.length; i++) {
        rosterShiftIdsToDelete.push(existingList[i].id);
      }

      for (let i = pairCount; i < desiredList.length; i++) {
        const desiredRow = desiredList[i];
        const newId = randomUUID();
        newRosterShiftRows.push({
          id: newId,
          rosterId: existing.id,
          shiftTemplateId: desiredRow.shiftTemplateId,
          date: new Date(desiredRow.date),
          headcount: desiredRow.headcount,
          responsibilityId: desiredRow.responsibilityId,
        });
        for (let j = 0; j < desiredRow.headcount; j++) {
          newAssignmentRows.push({ rosterShiftId: newId, staffId: null, unfilledTag: null });
        }
      }
    }

    if (rosterShiftIdsToDelete.length > 0) {
      await tx.rosterShift.deleteMany({ where: { id: { in: rosterShiftIdsToDelete } } });
    }
    if (assignmentIdsToDelete.length > 0) {
      await tx.assignment.deleteMany({ where: { id: { in: assignmentIdsToDelete } } });
    }
    if (headcountUpdates.length > 0) {
      await Promise.all(
        headcountUpdates.map((u) => tx.rosterShift.update({ where: { id: u.id }, data: { headcount: u.headcount } }))
      );
    }
    if (assignmentRowsToAdd.length > 0) {
      await tx.assignment.createMany({ data: assignmentRowsToAdd });
    }
    if (newRosterShiftRows.length > 0) {
      await tx.rosterShift.createMany({ data: newRosterShiftRows });
      await tx.assignment.createMany({ data: newAssignmentRows });
    }

    return roster;
  });

  res.json(updated);
});

rosterRouter.put('/:id/publish', async (req: AuthedRequest, res) => {
  const existing = await prisma.roster.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.userId !== req.userId) {
    return res.status(404).json({ error: 'Roster not found' });
  }
  if (existing.status !== 'preview' && existing.status !== 'published') {
    return res.status(409).json({ error: 'Generate assignments before publishing this roster' });
  }
  const roster = await prisma.roster.update({ where: { id: req.params.id }, data: { status: 'published' } });
  res.json(roster);
});

rosterRouter.delete('/:id', async (req: AuthedRequest, res) => {
  const existing = await prisma.roster.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.userId !== req.userId) {
    return res.status(404).json({ error: 'Roster not found' });
  }
  await prisma.roster.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
