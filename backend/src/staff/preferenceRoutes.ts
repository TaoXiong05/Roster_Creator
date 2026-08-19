import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../auth/middleware';

export const preferenceRouter = Router();
preferenceRouter.use(requireAuth);

const HOURS_PERIODS = ['weekly', 'fortnightly', 'monthly'];
const HOURS_UNITS = ['hours', 'shifts'];

preferenceRouter.put('/:id/preference', async (req: AuthedRequest, res) => {
  const staff = await prisma.staff.findUnique({ where: { id: req.params.id } });
  if (!staff || staff.userId !== req.userId) {
    return res.status(404).json({ error: 'Staff not found' });
  }

  const {
    preferredShifts,
    unavailableDateRanges,
    minHours,
    maxHours,
    hoursPeriod,
    hoursUnit,
  } = req.body as {
    preferredShifts?: { weekday: number; shiftTemplateId: string }[];
    unavailableDateRanges?: { start: string; end: string }[];
    minHours?: number;
    maxHours?: number;
    hoursPeriod?: string;
    hoursUnit?: string;
  };

  if (minHours === undefined || maxHours === undefined) {
    return res.status(400).json({ error: 'minHours and maxHours are required' });
  }
  if (minHours > maxHours) {
    return res.status(400).json({ error: 'minHours cannot exceed maxHours' });
  }
  if (hoursPeriod !== undefined && !HOURS_PERIODS.includes(hoursPeriod)) {
    return res.status(400).json({ error: `hoursPeriod must be one of ${HOURS_PERIODS.join(', ')}` });
  }
  if (hoursUnit !== undefined && !HOURS_UNITS.includes(hoursUnit)) {
    return res.status(400).json({ error: `hoursUnit must be one of ${HOURS_UNITS.join(', ')}` });
  }
  const isValidPreferredShifts =
    preferredShifts === undefined ||
    (Array.isArray(preferredShifts) &&
      preferredShifts.every(
        (p) =>
          p &&
          typeof p.weekday === 'number' &&
          p.weekday >= 0 &&
          p.weekday <= 6 &&
          typeof p.shiftTemplateId === 'string'
      ));
  if (!isValidPreferredShifts) {
    return res.status(400).json({ error: 'preferredShifts must be an array of { weekday, shiftTemplateId }' });
  }

  const data = {
    preferredShifts: preferredShifts ?? [],
    unavailableDateRanges: unavailableDateRanges ?? [],
    minHours,
    maxHours,
    hoursPeriod: hoursPeriod ?? 'weekly',
    hoursUnit: hoursUnit ?? 'hours',
  };

  const preference = await prisma.preference.upsert({
    where: { staffId: req.params.id },
    create: { staffId: req.params.id, ...data },
    update: data,
  });
  res.json(preference);
});
