import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../auth/middleware';
import { buildIcs } from './ics';
import { sendEmail } from '../email/resend';

export const emailRouter = Router();
emailRouter.use(requireAuth);

interface StaffScheduleRow {
  date: string;
  shiftName: string;
  startTime: string;
  endTime: string;
}

emailRouter.post('/:id/send-emails', async (req: AuthedRequest, res) => {
  const roster = await prisma.roster.findUnique({
    where: { id: req.params.id },
    include: {
      rosterShifts: {
        include: { shiftTemplate: true, assignments: { include: { staff: true } } },
      },
    },
  });
  if (!roster || roster.userId !== req.userId) {
    return res.status(404).json({ error: 'Roster not found' });
  }

  const { staffIds } = req.body as { staffIds?: string[] };

  const shiftsByStaff = new Map<string, { name: string; email: string; rows: StaffScheduleRow[] }>();
  for (const rs of roster.rosterShifts) {
    for (const a of rs.assignments) {
      if (!a.staffId || !a.staff) continue;
      if (staffIds && !staffIds.includes(a.staffId)) continue;
      const entry = shiftsByStaff.get(a.staffId) ?? { name: a.staff.name, email: a.staff.email, rows: [] };
      entry.rows.push({
        date: rs.date.toISOString().slice(0, 10),
        shiftName: rs.shiftTemplate.name,
        startTime: rs.shiftTemplate.startTime,
        endTime: rs.shiftTemplate.endTime,
      });
      shiftsByStaff.set(a.staffId, entry);
    }
  }

  const sentTo: string[] = [];
  const failed: string[] = [];
  for (const [staffId, entry] of shiftsByStaff) {
    const ics = buildIcs(
      entry.rows.map((row, index) => ({
        uid: `${roster.id}-${staffId}-${index}@roster-creator`,
        summary: row.shiftName,
        startDate: row.date,
        startTime: row.startTime,
        endTime: row.endTime,
      }))
    );
    const html = [
      `<p>你好 ${entry.name}，以下是你在「${roster.name}」的排班：</p>`,
      '<ul>',
      ...entry.rows.map((row) => `<li>${row.date} ${row.shiftName}（${row.startTime}-${row.endTime}）</li>`),
      '</ul>',
    ].join('');

    try {
      await sendEmail({
        to: entry.email,
        subject: `你的排班表：${roster.name}`,
        html,
        attachments: [{ filename: `${roster.name}.ics`, content: Buffer.from(ics).toString('base64') }],
      });
      sentTo.push(entry.email);
    } catch {
      failed.push(entry.email);
    }
  }

  res.json({ sentTo, failed });
});
