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

  for (const shift of shifts) {
    const template = await prisma.shiftTemplate.findUnique({ where: { id: shift.shiftTemplateId } });
    if (!template || template.userId !== req.userId) {
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

  for (const shift of shifts) {
    const template = await prisma.shiftTemplate.findUnique({ where: { id: shift.shiftTemplateId } });
    if (!template || template.userId !== req.userId) {
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

  const updated = await prisma.$transaction(async (tx) => {
    const roster = await tx.roster.update({
      where: { id: existing.id },
      data: {
        name,
        dateRangeStart: new Date(dateRangeStart),
        dateRangeEnd: new Date(dateRangeEnd),
        groupId,
        hoursPerShift: hoursPerShift ?? existing.hoursPerShift,
      },
    });
    await tx.rosterShift.deleteMany({ where: { rosterId: existing.id } });

    const rosterShiftRows = shifts.flatMap((shift) =>
      shift.dates.flatMap((date) =>
        shift.requirements.map((requirement) => ({
          id: randomUUID(),
          rosterId: existing.id,
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
    return roster;
  });

  res.json(updated);
});

rosterRouter.put('/:id/publish', async (req: AuthedRequest, res) => {
  const existing = await prisma.roster.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.userId !== req.userId) {
    return res.status(404).json({ error: 'Roster not found' });
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
