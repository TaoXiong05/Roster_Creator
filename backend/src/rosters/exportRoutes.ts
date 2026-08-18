import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../auth/middleware';
import { buildIcs } from './ics';
import { buildCsv } from './csv';
import { buildPdf } from './pdf';

export const exportRouter = Router();
exportRouter.use(requireAuth);

async function loadExportableRoster(rosterId: string, userId: string, staffId?: string) {
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

  const rows = roster.rosterShifts.flatMap((rs) =>
    rs.assignments
      .filter((a) => a.staffId && (!staffId || a.staffId === staffId))
      .map((a) => ({
        date: rs.date.toISOString().slice(0, 10),
        shiftName: rs.shiftTemplate.name,
        startTime: rs.shiftTemplate.startTime,
        endTime: rs.shiftTemplate.endTime,
        staffName: a.staff!.name,
      }))
  );

  return { roster, rows };
}

exportRouter.get('/:id/export/ics', async (req: AuthedRequest, res) => {
  const staffId = typeof req.query.staffId === 'string' ? req.query.staffId : undefined;
  const data = await loadExportableRoster(req.params.id, req.userId!, staffId);
  if (!data) return res.status(404).json({ error: 'Roster not found' });

  const ics = buildIcs(
    data.rows.map((row, index) => ({
      uid: `${data.roster.id}-${index}@roster-creator`,
      summary: `${row.shiftName} (${row.staffName})`,
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
  const data = await loadExportableRoster(req.params.id, req.userId!, staffId);
  if (!data) return res.status(404).json({ error: 'Roster not found' });

  const csv = buildCsv(data.rows);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${data.roster.name}.csv"`);
  res.send(csv);
});

exportRouter.get('/:id/export/pdf', async (req: AuthedRequest, res) => {
  const staffId = typeof req.query.staffId === 'string' ? req.query.staffId : undefined;
  const data = await loadExportableRoster(req.params.id, req.userId!, staffId);
  if (!data) return res.status(404).json({ error: 'Roster not found' });

  const pdf = await buildPdf(data.roster.name, data.rows);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${data.roster.name}.pdf"`);
  res.send(pdf);
});
