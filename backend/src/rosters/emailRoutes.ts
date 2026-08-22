import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../auth/middleware';
import { buildIcs } from './ics';
import { sendEmail } from '../email/resend';
import { toDisplayDate } from './dateFormat';
import { groupRowsByDate } from './rosterGrouping';
import { heavyActionLimiter } from '../rateLimit';

export const emailRouter = Router();
emailRouter.use(requireAuth);

interface StaffScheduleRow {
  date: string;
  shiftName: string;
  startTime: string;
  endTime: string;
}

export type EmailLanguage = 'en' | 'zh';

// Mirrors the frontend's LanguageContext default ('en' when no stored preference) — the backend
// has no session state of its own, so the frontend passes along whatever language is active there.
function resolveLanguage(value: unknown): EmailLanguage {
  return value === 'zh' ? 'zh' : 'en';
}

const WEEKDAYS: Record<EmailLanguage, string[]> = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  zh: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'],
};

const STRINGS: Record<EmailLanguage, { subject: (roster: string) => string; greeting: (name: string, roster: string) => string }> = {
  en: {
    subject: (roster) => `Your schedule: ${roster}`,
    greeting: (name, roster) => `Hi ${name}, here's your schedule for "${roster}":`,
  },
  zh: {
    subject: (roster) => `你的排班表：${roster}`,
    greeting: (name, roster) => `你好 ${name}，以下是你在「${roster}」的排班：`,
  },
};

function weekdayLabel(isoDate: string, language: EmailLanguage): string {
  return WEEKDAYS[language][new Date(`${isoDate}T00:00:00Z`).getUTCDay()];
}

// Matches the app's own brand palette (frontend/tailwind.config.js) and the PDF/Excel exports —
// tables with inline styles because email clients (Outlook especially) don't support flex/grid
// and often strip <style> blocks.
const COLORS = {
  headerBg: '#B04D22',
  headerSubtitle: '#F4A97C',
  ink: '#3A2B22',
  dayBg: '#FFF3E2',
  dayText: '#6B5647',
  rule: '#F0E4D3',
};

export function buildScheduleHtml(
  rosterName: string,
  dateRangeStart: string,
  dateRangeEnd: string,
  staffName: string,
  rows: StaffScheduleRow[],
  language: EmailLanguage
): string {
  const sortedRows = [...rows].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  const days = groupRowsByDate(sortedRows);

  const dayRows = days
    .map(
      (day) => `
        <tr><td style="background:${COLORS.dayBg};color:${COLORS.dayText};font-weight:bold;font-size:12px;padding:6px 10px;border-radius:6px;font-family:Arial,sans-serif;">${toDisplayDate(day.date)} (${weekdayLabel(day.date, language)})</td></tr>
        ${day.rows
          .map(
            (row) =>
              `<tr><td style="padding:8px 10px 8px 20px;font-size:13px;color:${COLORS.ink};border-bottom:1px solid ${COLORS.rule};font-family:Arial,sans-serif;">${row.shiftName} · ${row.startTime}–${row.endTime}</td></tr>`
          )
          .join('')}`
    )
    .join('');

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.dayBg};padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-collapse:collapse;">
          <tr><td style="background:${COLORS.headerBg};padding:20px 24px;">
            <div style="color:#ffffff;font-size:18px;font-weight:bold;font-family:Arial,sans-serif;">${rosterName}</div>
            <div style="color:${COLORS.headerSubtitle};font-size:12px;margin-top:4px;font-family:Arial,sans-serif;">${toDisplayDate(dateRangeStart)} – ${toDisplayDate(dateRangeEnd)}</div>
          </td></tr>
          <tr><td style="padding:20px 24px 6px;font-size:14px;color:${COLORS.ink};font-family:Arial,sans-serif;">${STRINGS[language].greeting(staffName, rosterName)}</td></tr>
          <tr><td style="padding:0 24px 20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${dayRows}</table>
          </td></tr>
        </table>
      </td></tr>
    </table>
  `;
}

emailRouter.post('/:id/send-emails', heavyActionLimiter, async (req: AuthedRequest, res) => {
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
  if (roster.status !== 'published') {
    return res.status(409).json({ error: 'Publish this roster before sending emails' });
  }

  const { staffIds, language: rawLanguage } = req.body as { staffIds?: string[]; language?: string };
  const language = resolveLanguage(rawLanguage);

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

  const entries = Array.from(shiftsByStaff.entries());
  const results = await Promise.allSettled(
    entries.map(async ([staffId, entry]) => {
      const ics = buildIcs(
        entry.rows.map((row, index) => ({
          uid: `${roster.id}-${staffId}-${index}@roster-creator`,
          summary: row.shiftName,
          startDate: row.date,
          startTime: row.startTime,
          endTime: row.endTime,
        }))
      );
      const html = buildScheduleHtml(
        roster.name,
        roster.dateRangeStart.toISOString().slice(0, 10),
        roster.dateRangeEnd.toISOString().slice(0, 10),
        entry.name,
        entry.rows,
        language
      );

      await sendEmail({
        to: entry.email,
        subject: STRINGS[language].subject(roster.name),
        html,
        attachments: [{ filename: `${roster.name}.ics`, content: Buffer.from(ics).toString('base64') }],
      });
    })
  );

  const sentTo: string[] = [];
  const failed: string[] = [];
  results.forEach((result, i) => {
    const email = entries[i][1].email;
    if (result.status === 'fulfilled') sentTo.push(email);
    else failed.push(email);
  });

  res.json({ sentTo, failed });
});
