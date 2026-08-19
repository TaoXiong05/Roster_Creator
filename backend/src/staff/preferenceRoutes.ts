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
    unavailableShifts,
    unavailableDateRanges,
    minHours,
    maxHours,
    hoursPeriod,
    hoursUnit,
  } = req.body as {
    preferredShifts?: { weekday: number; shiftTemplateId: string }[];
    unavailableShifts?: { weekday: number; shiftTemplateId: string }[];
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
  const isWeekdayShiftList = (value: unknown): value is { weekday: number; shiftTemplateId: string }[] =>
    Array.isArray(value) &&
    value.every(
      (p) =>
        p &&
        typeof p.weekday === 'number' &&
        p.weekday >= 0 &&
        p.weekday <= 6 &&
        typeof p.shiftTemplateId === 'string'
    );
  if (preferredShifts !== undefined && !isWeekdayShiftList(preferredShifts)) {
    return res.status(400).json({ error: 'preferredShifts must be an array of { weekday, shiftTemplateId }' });
  }
  if (unavailableShifts !== undefined && !isWeekdayShiftList(unavailableShifts)) {
    return res.status(400).json({ error: 'unavailableShifts must be an array of { weekday, shiftTemplateId }' });
  }
  const isValidDateRanges =
    unavailableDateRanges === undefined ||
    (Array.isArray(unavailableDateRanges) &&
      unavailableDateRanges.every((r) => r && typeof r.start === 'string' && typeof r.end === 'string'));
  if (!isValidDateRanges) {
    return res.status(400).json({ error: 'unavailableDateRanges must be an array of { start, end }' });
  }

  const data = {
    preferredShifts: preferredShifts ?? [],
    unavailableShifts: unavailableShifts ?? [],
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
