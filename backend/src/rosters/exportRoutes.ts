import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../auth/middleware';
import { buildIcs } from './ics';
import { buildCsv } from './csv';
import { buildPdf } from './pdf';
import { toDisplayDate } from './dateFormat';

export const exportRouter = Router();
exportRouter.use(requireAuth);

async function loadExportableRoster(rosterId: string, userId: string, staffId?: string, unfilledOnly?: boolean) {
  const roster = await prisma.roster.findUnique({
    where: { id: rosterId },
    include: {
      rosterShifts: {
        include: { shiftTemplate: true, assignments: { include: { staff: true } } },
        orderBy: { date: 'asc' },
      },
    },
  });
  if (!roster || roster.userId !== userId) return null;

  // responsibilityId is a plain string field (not a Prisma relation), so role names are resolved
  // the same way the rest of the app does: fetch the templates separately and match by id.
  const responsibilities = await prisma.responsibilityTemplate.findMany({ where: { userId } });
  const responsibilityNameById = new Map(responsibilities.map((r) => [r.id, r.name]));

  // A personal export (staffId given) only ever shows that person's own shifts — an unfilled slot
  // isn't theirs, so it's excluded there. unfilledOnly (used when exporting from the Unfilled tab)
  // keeps only the gaps. Otherwise (the default full-roster export) everything is included.
  const rows = roster.rosterShifts.flatMap((rs) =>
    rs.assignments
      .filter((a) => {
        if (staffId) return a.staffId === staffId;
        if (unfilledOnly) return !a.staffId;
        return true;
      })
      .map((a) => ({
        date: rs.date.toISOString().slice(0, 10),
        shiftName: rs.shiftTemplate.name,
        responsibilityName: responsibilityNameById.get(rs.responsibilityId) ?? 'Unknown role',
        startTime: rs.shiftTemplate.startTime,
        endTime: rs.shiftTemplate.endTime,
        staffName: a.staff ? a.staff.name : a.unfilledTag ? `UNFILLED (${a.unfilledTag})` : 'UNFILLED',
        unfilled: !a.staffId,
      }))
  );

  return { roster, rows };
}

exportRouter.get('/:id/export/ics', async (req: AuthedRequest, res) => {
  const staffId = typeof req.query.staffId === 'string' ? req.query.staffId : undefined;
  const unfilledOnly = req.query.unfilledOnly === 'true';
  const data = await loadExportableRoster(req.params.id, req.userId!, staffId, unfilledOnly);
  if (!data) return res.status(404).json({ error: 'Roster not found' });
  if (data.roster.status !== 'published') {
    return res.status(409).json({ error: 'Publish this roster before exporting it' });
  }

  const ics = buildIcs(
    data.rows.map((row, index) => ({
      uid: `${data.roster.id}-${index}@roster-creator`,
      summary: row.unfilled
        ? `⚠ UNFILLED - ${row.shiftName} · ${row.responsibilityName}`
        : `${row.shiftName} · ${row.responsibilityName} (${row.staffName})`,
      startDate: row.date,
      startTime: row.startTime,
      endTime: row.endTime,
    }))
  );

  res.setHeader('Content-Type', 'text/calendar');
  res.setHeader('Content-Disposition', `attachment; filename="${data.roster.name}.ics"`);
  res.send(ics);
});

exportRouter.get('/:id/export/csv', async (req: AuthedRequest, res) => {
  const staffId = typeof req.query.staffId === 'string' ? req.query.staffId : undefined;
  const unfilledOnly = req.query.unfilledOnly === 'true';
  const data = await loadExportableRoster(req.params.id, req.userId!, staffId, unfilledOnly);
  if (!data) return res.status(404).json({ error: 'Roster not found' });
  if (data.roster.status !== 'published') {
    return res.status(409).json({ error: 'Publish this roster before exporting it' });
  }

  const csv = buildCsv(data.rows.map((row) => ({ ...row, date: toDisplayDate(row.date) })));

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${data.roster.name}.csv"`);
  res.send(csv);
});

exportRouter.get('/:id/export/pdf', async (req: AuthedRequest, res) => {
  const staffId = typeof req.query.staffId === 'string' ? req.query.staffId : undefined;
  const unfilledOnly = req.query.unfilledOnly === 'true';
  const data = await loadExportableRoster(req.params.id, req.userId!, staffId, unfilledOnly);
  if (!data) return res.status(404).json({ error: 'Roster not found' });
  if (data.roster.status !== 'published') {
    return res.status(409).json({ error: 'Publish this roster before exporting it' });
  }

  const pdf = await buildPdf(data.roster.name, data.roster.dateRangeStart.toISOString().slice(0, 10), data.rows);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${data.roster.name}.pdf"`);
  res.send(pdf);
});
