import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../auth/middleware';

export const preferenceRouter = Router();
preferenceRouter.use(requireAuth);

preferenceRouter.put('/:id/preference', async (req: AuthedRequest, res) => {
  const staff = await prisma.staff.findUnique({ where: { id: req.params.id } });
  if (!staff || staff.userId !== req.userId) {
    return res.status(404).json({ error: 'Staff not found' });
  }

  const {
    preferredShiftTemplateIds,
    unavailableDateRanges,
    minHoursPerWeek,
    maxHoursPerWeek,
    preferredWeekdays,
  } = req.body as {
    preferredShiftTemplateIds?: string[];
    unavailableDateRanges?: { start: string; end: string }[];
    minHoursPerWeek?: number;
    maxHoursPerWeek?: number;
    preferredWeekdays?: number[];
  };

  if (minHoursPerWeek === undefined || maxHoursPerWeek === undefined) {
    return res.status(400).json({ error: 'minHoursPerWeek and maxHoursPerWeek are required' });
  }
  if (minHoursPerWeek > maxHoursPerWeek) {
    return res.status(400).json({ error: 'minHoursPerWeek cannot exceed maxHoursPerWeek' });
  }

  const data = {
    preferredShiftTemplateIds: preferredShiftTemplateIds ?? [],
    unavailableDateRanges: unavailableDateRanges ?? [],
    minHoursPerWeek,
    maxHoursPerWeek,
    preferredWeekdays: preferredWeekdays ?? [],
  };

  const preference = await prisma.preference.upsert({
    where: { staffId: req.params.id },
    create: { staffId: req.params.id, ...data },
    update: data,
  });
  res.json(preference);
});
