# Roster Creator — Plan 5: 发布、导出与邮件发送 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成排班表的发布状态标记、三种格式（ICS/CSV/PDF）导出（支持整组或单个员工两种粒度），以及通过 Resend 把每位员工的个人排班表（含 ICS 附件）邮件发送出去。

**Architecture:** 后端把"生成导出内容"拆成纯函数工具（`ics.ts`/`csv.ts`/`pdf.ts`），导出路由和邮件路由复用同一份"Roster → 已分配 Assignment 行"查询逻辑；前端在 Roster 详情页加发布按钮、三个导出下载链接、发送邮件按钮（整组 + 按员工单发两种粒度）。

**Tech Stack:** 与 Plan 1-4 相同，新增 `pdfkit`（PDF 生成）

**Spec:** [docs/superpowers/specs/2026-08-18-roster-creator-design.md](../specs/2026-08-18-roster-creator-design.md)

**依赖：** 假定 Plan 1-4 已执行完成——`requireAuth`、`prisma`、`rosterRouter`、`sendEmail`（Plan 1 的 `backend/src/email/resend.ts`）、前端 `api/client.ts`、`RosterDetailPage`（Plan 4 的可编辑复核版本）均已存在。

## Global Constraints

- 导出支持 ICS / Excel(CSV) / PDF 三种格式，且支持"整组"或"单个员工"两种粒度（spec 5.6）
- 邮件发送可选择"发送给全体/单个员工"，正文列出班次明细，附件带该员工的 ICS（spec 5.6）
- 发布（status → published）不锁定编辑，只是状态标记（spec 5.6）
- 导出/邮件内容只包含已分配（`staffId` 非空）的 Assignment 行，未分配坑位不出现在员工的个人时间表里

---

## 文件结构总览

```
backend/src/
  rosters/
    routes.ts              — modify: 加 PUT /:id/publish
    ics.ts, csv.ts, pdf.ts — 纯函数导出工具
    exportRoutes.ts        — GET /:id/export/{ics,csv,pdf}
    emailRoutes.ts         — POST /:id/send-emails
    __tests__/routes.test.ts (modify), ics.test.ts, csv.test.ts, pdf.test.ts,
              exportRoutes.test.ts, emailRoutes.test.ts
  email/
    resend.ts               — modify: sendEmail 支持 attachments
    __tests__/resend.test.ts
  app.ts                    — modify: 挂载 exportRouter, emailRouter
  package.json               — modify: 加 pdfkit 依赖

frontend/src/
  api/client.ts              — modify: 加 publish/exportUrl/sendEmails
  pages/RosterDetailPage.tsx — modify: 加发布/导出/发邮件 UI
  pages/__tests__/RosterDetailPage.test.tsx — modify
```

---

### Task 1: 发布端点

**Files:**
- Modify: `backend/src/rosters/routes.ts`
- Modify: `backend/src/rosters/__tests__/routes.test.ts`

**Interfaces:**
- Produces: `PUT /rosters/:id/publish`，返回更新后的 Roster（`status: 'published'`）

- [ ] **Step 1: 追加失败的测试**

```ts
// backend/src/rosters/__tests__/routes.test.ts — 追加到文件末尾
describe('PUT /rosters/:id/publish', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 404 for another user\'s roster', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({ id: 'roster-1', userId: 'someone-else' });

    const res = await request(app).put('/rosters/roster-1/publish').set('Cookie', authCookie);

    expect(res.status).toBe(404);
  });

  it('marks the roster as published', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({ id: 'roster-1', userId: 'user-1' });
    (prisma.roster.update as any).mockResolvedValue({ id: 'roster-1', status: 'published' });

    const res = await request(app).put('/rosters/roster-1/publish').set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('published');
    expect(prisma.roster.update).toHaveBeenCalledWith({ where: { id: 'roster-1' }, data: { status: 'published' } });
  });
});
```

需要在文件顶部的 `vi.mock('../../db', ...)` 里给 `roster` 补上 `update: vi.fn()`（如果之前没有的话，检查现有 mock 块并补齐）。

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && npx vitest run src/rosters/__tests__/routes.test.ts`
Expected: FAIL — 路由不存在，返回 404（因为路由未定义会 fall through 到 Express 默认 404，而不是我们自定义的 not-found 分支——用 `res.body.error` 断言会失败）

- [ ] **Step 3: 追加 publish 处理器到 routes.ts**

```ts
// backend/src/rosters/routes.ts — 追加到文件末尾
rosterRouter.put('/:id/publish', async (req: AuthedRequest, res) => {
  const existing = await prisma.roster.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.userId !== req.userId) {
    return res.status(404).json({ error: 'Roster not found' });
  }
  const roster = await prisma.roster.update({ where: { id: req.params.id }, data: { status: 'published' } });
  res.json(roster);
});
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd backend && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/rosters/routes.ts backend/src/rosters/__tests__/routes.test.ts
git commit -m "feat(backend): add roster publish endpoint"
```

---

### Task 2: 导出工具函数（ICS / CSV / PDF）

**Files:**
- Modify: `backend/package.json`（加 `pdfkit`, `@types/pdfkit`）
- Create: `backend/src/rosters/ics.ts`
- Create: `backend/src/rosters/csv.ts`
- Create: `backend/src/rosters/pdf.ts`
- Test: `backend/src/rosters/__tests__/ics.test.ts`
- Test: `backend/src/rosters/__tests__/csv.test.ts`
- Test: `backend/src/rosters/__tests__/pdf.test.ts`

**Interfaces:**
- Produces: `buildIcs(events: IcsEvent[]): string`；`buildCsv(rows: CsvRow[]): string`；`buildPdf(title: string, rows: PdfRow[]): Promise<Buffer>`

- [ ] **Step 1: 安装 pdfkit**

```bash
cd backend && npm install pdfkit && npm install -D @types/pdfkit
```

- [ ] **Step 2: 写失败的 ics 测试**

```ts
// backend/src/rosters/__tests__/ics.test.ts
import { describe, it, expect } from 'vitest';
import { buildIcs } from '../ics';

describe('buildIcs', () => {
  it('produces a valid VCALENDAR wrapper with one VEVENT per entry', () => {
    const ics = buildIcs([
      { uid: 'evt-1', summary: 'Morning (Alice)', startDate: '2026-08-17', startTime: '06:00', endTime: '14:00' },
    ]);

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).toContain('UID:evt-1');
    expect(ics).toContain('SUMMARY:Morning (Alice)');
    expect(ics).toContain('DTSTART:20260817T060000');
    expect(ics).toContain('DTEND:20260817T140000');
  });

  it('produces an empty event list when given no events', () => {
    const ics = buildIcs([]);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).not.toContain('BEGIN:VEVENT');
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `cd backend && npx vitest run src/rosters/__tests__/ics.test.ts`
Expected: FAIL — `Cannot find module '../ics'`

- [ ] **Step 4: 实现 ics.ts**

```ts
// backend/src/rosters/ics.ts
export interface IcsEvent {
  uid: string;
  summary: string;
  description?: string;
  startDate: string;
  startTime: string;
  endTime: string;
}

function formatIcsDateTime(date: string, time: string): string {
  const [hours, minutes] = time.split(':');
  return `${date.replace(/-/g, '')}T${hours}${minutes}00`;
}

export function buildIcs(events: IcsEvent[]): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Roster Creator//EN'];
  for (const event of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.uid}`,
      `SUMMARY:${event.summary}`,
      `DTSTART:${formatIcsDateTime(event.startDate, event.startTime)}`,
      `DTEND:${formatIcsDateTime(event.startDate, event.endTime)}`,
      ...(event.description ? [`DESCRIPTION:${event.description}`] : []),
      'END:VEVENT'
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd backend && npx vitest run src/rosters/__tests__/ics.test.ts`
Expected: PASS

- [ ] **Step 6: 写失败的 csv 测试**

```ts
// backend/src/rosters/__tests__/csv.test.ts
import { describe, it, expect } from 'vitest';
import { buildCsv } from '../csv';

describe('buildCsv', () => {
  it('writes a header row followed by one row per entry', () => {
    const csv = buildCsv([
      { date: '2026-08-17', shiftName: 'Morning', startTime: '06:00', endTime: '14:00', staffName: 'Alice' },
    ]);

    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('Date,Shift,Start,End,Staff');
    expect(lines[1]).toBe('2026-08-17,Morning,06:00,14:00,Alice');
  });

  it('quotes fields containing commas', () => {
    const csv = buildCsv([
      { date: '2026-08-17', shiftName: 'Morning, Extra', startTime: '06:00', endTime: '14:00', staffName: 'Alice' },
    ]);

    expect(csv).toContain('"Morning, Extra"');
  });
});
```

- [ ] **Step 7: 运行测试确认失败**

Run: `cd backend && npx vitest run src/rosters/__tests__/csv.test.ts`
Expected: FAIL — `Cannot find module '../csv'`

- [ ] **Step 8: 实现 csv.ts**

```ts
// backend/src/rosters/csv.ts
export interface CsvRow {
  date: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  staffName: string;
}

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildCsv(rows: CsvRow[]): string {
  const header = ['Date', 'Shift', 'Start', 'End', 'Staff'];
  const lines = [header.join(',')];
  for (const row of rows) {
    lines.push([row.date, row.shiftName, row.startTime, row.endTime, row.staffName].map(escapeCsvField).join(','));
  }
  return lines.join('\r\n');
}
```

- [ ] **Step 9: 运行测试确认通过**

Run: `cd backend && npx vitest run src/rosters/__tests__/csv.test.ts`
Expected: PASS

- [ ] **Step 10: 写失败的 pdf 测试**

```ts
// backend/src/rosters/__tests__/pdf.test.ts
import { describe, it, expect } from 'vitest';
import { buildPdf } from '../pdf';

describe('buildPdf', () => {
  it('produces a valid PDF buffer', async () => {
    const buffer = await buildPdf('Week 34', [
      { date: '2026-08-17', shiftName: 'Morning', startTime: '06:00', endTime: '14:00', staffName: 'Alice' },
    ]);

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
```

- [ ] **Step 11: 运行测试确认失败**

Run: `cd backend && npx vitest run src/rosters/__tests__/pdf.test.ts`
Expected: FAIL — `Cannot find module '../pdf'`

- [ ] **Step 12: 实现 pdf.ts**

```ts
// backend/src/rosters/pdf.ts
import PDFDocument from 'pdfkit';

export interface PdfRow {
  date: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  staffName: string;
}

export function buildPdf(title: string, rows: PdfRow[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text(title, { align: 'left' });
    doc.moveDown();
    doc.fontSize(10);
    for (const row of rows) {
      doc.text(`${row.date}  ${row.shiftName} (${row.startTime}-${row.endTime})  —  ${row.staffName}`);
    }
    doc.end();
  });
}
```

- [ ] **Step 13: 运行测试确认通过**

Run: `cd backend && npm test`
Expected: PASS

- [ ] **Step 14: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/src/rosters/ics.ts backend/src/rosters/csv.ts backend/src/rosters/pdf.ts backend/src/rosters/__tests__/ics.test.ts backend/src/rosters/__tests__/csv.test.ts backend/src/rosters/__tests__/pdf.test.ts
git commit -m "feat(backend): add ics, csv and pdf export utilities"
```

---

### Task 3: 导出路由

**Files:**
- Create: `backend/src/rosters/exportRoutes.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/src/rosters/__tests__/exportRoutes.test.ts`

**Interfaces:**
- Consumes: `buildIcs` from `./ics`, `buildCsv` from `./csv`, `buildPdf` from `./pdf`
- Produces: `exportRouter`（挂载于 `/rosters`）：`GET /:id/export/ics`, `GET /:id/export/csv`, `GET /:id/export/pdf`，均支持可选 query `?staffId=` 缩小到单个员工

- [ ] **Step 1: 写失败的测试**

```ts
// backend/src/rosters/__tests__/exportRoutes.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../db', () => ({
  prisma: { roster: { findUnique: vi.fn() } },
}));

import { prisma } from '../../db';
import { createApp } from '../../app';
import { signToken } from '../../auth/jwt';

const app = createApp();
const authCookie = `token=${signToken({ userId: 'user-1' })}`;

const rosterFixture = {
  id: 'roster-1',
  userId: 'user-1',
  name: 'Week 34',
  rosterShifts: [
    {
      date: new Date('2026-08-17'),
      shiftTemplate: { name: 'Morning', startTime: '06:00', endTime: '14:00' },
      assignments: [
        { staffId: 'staff-1', staff: { id: 'staff-1', name: 'Alice' } },
        { staffId: null, staff: null },
      ],
    },
  ],
};

describe('GET /rosters/:id/export/ics', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 404 for another user\'s roster', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({ id: 'roster-1', userId: 'someone-else' });

    const res = await request(app).get('/rosters/roster-1/export/ics').set('Cookie', authCookie);

    expect(res.status).toBe(404);
  });

  it('returns an ics calendar with only assigned staff', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue(rosterFixture);

    const res = await request(app).get('/rosters/roster-1/export/ics').set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/calendar');
    expect(res.text).toContain('SUMMARY:Morning (Alice)');
  });

  it('filters to a single staff member when staffId is given', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({
      ...rosterFixture,
      rosterShifts: [
        {
          ...rosterFixture.rosterShifts[0],
          assignments: [
            { staffId: 'staff-1', staff: { id: 'staff-1', name: 'Alice' } },
            { staffId: 'staff-2', staff: { id: 'staff-2', name: 'Bob' } },
          ],
        },
      ],
    });

    const res = await request(app).get('/rosters/roster-1/export/ics?staffId=staff-2').set('Cookie', authCookie);

    expect(res.text).toContain('Bob');
    expect(res.text).not.toContain('Alice');
  });
});

describe('GET /rosters/:id/export/csv', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a csv table', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue(rosterFixture);

    const res = await request(app).get('/rosters/roster-1/export/csv').set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('Alice');
  });
});

describe('GET /rosters/:id/export/pdf', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a pdf document', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue(rosterFixture);

    const res = await request(app).get('/rosters/roster-1/export/pdf').set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && npx vitest run src/rosters/__tests__/exportRoutes.test.ts`
Expected: FAIL — `Cannot find module '../exportRoutes'`

- [ ] **Step 3: 实现 exportRoutes.ts**

```ts
// backend/src/rosters/exportRoutes.ts
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
```

- [ ] **Step 4: 挂载到 app.ts**

```ts
// backend/src/app.ts — 顶部加 import { exportRouter } from './rosters/exportRoutes';
  app.use('/rosters', exportRouter);
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd backend && npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/rosters/exportRoutes.ts backend/src/app.ts backend/src/rosters/__tests__/exportRoutes.test.ts
git commit -m "feat(backend): add ics/csv/pdf export endpoints"
```

---

### Task 4: 邮件附件支持 + 发送排班邮件端点

**Files:**
- Modify: `backend/src/email/resend.ts`
- Test: `backend/src/email/__tests__/resend.test.ts`
- Create: `backend/src/rosters/emailRoutes.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/src/rosters/__tests__/emailRoutes.test.ts`

**Interfaces:**
- Consumes: `buildIcs` from `./ics`
- Produces: `sendEmail` 追加可选 `attachments?: { filename: string; content: string }[]` 参数；`emailRouter`（挂载于 `/rosters`）：`POST /:id/send-emails`，body `{ staffIds?: string[] }`，返回 `{ sentTo: string[] }`

- [ ] **Step 1: 写失败的 resend 测试**

```ts
// backend/src/email/__tests__/resend.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const sendMock = vi.fn();
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({ emails: { send: sendMock } })),
}));

import { sendEmail } from '../resend';

describe('sendEmail', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forwards attachments to resend', async () => {
    sendMock.mockResolvedValue({});

    await sendEmail({
      to: 'a@b.com',
      subject: 'Your schedule',
      html: '<p>hi</p>',
      attachments: [{ filename: 'schedule.ics', content: 'QkVHSU4=' }],
    });

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'a@b.com',
        attachments: [{ filename: 'schedule.ics', content: 'QkVHSU4=' }],
      })
    );
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && npx vitest run src/email/__tests__/resend.test.ts`
Expected: FAIL — `sendEmail` 目前不接受 `attachments` 参数，TypeScript 编译报错或 mock 断言失败

- [ ] **Step 3: 修改 resend.ts**

```ts
// backend/src/email/resend.ts — 用下面内容整体替换
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export interface EmailAttachment {
  filename: string;
  content: string;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}

export async function sendEmail({ to, subject, html, attachments }: SendEmailInput): Promise<void> {
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
    to,
    subject,
    html,
    attachments,
  });
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd backend && npx vitest run src/email/__tests__/resend.test.ts`
Expected: PASS

- [ ] **Step 5: 写失败的 emailRoutes 测试**

```ts
// backend/src/rosters/__tests__/emailRoutes.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../db', () => ({
  prisma: { roster: { findUnique: vi.fn() } },
}));
vi.mock('../../email/resend', () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));

import { prisma } from '../../db';
import { sendEmail } from '../../email/resend';
import { createApp } from '../../app';
import { signToken } from '../../auth/jwt';

const app = createApp();
const authCookie = `token=${signToken({ userId: 'user-1' })}`;

const rosterFixture = {
  id: 'roster-1',
  userId: 'user-1',
  name: 'Week 34',
  rosterShifts: [
    {
      date: new Date('2026-08-17'),
      shiftTemplate: { name: 'Morning', startTime: '06:00', endTime: '14:00' },
      assignments: [
        { staffId: 'staff-1', staff: { id: 'staff-1', name: 'Alice', email: 'alice@b.com' } },
        { staffId: 'staff-2', staff: { id: 'staff-2', name: 'Bob', email: 'bob@b.com' } },
        { staffId: null, staff: null },
      ],
    },
  ],
};

describe('POST /rosters/:id/send-emails', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 404 for another user\'s roster', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({ id: 'roster-1', userId: 'someone-else' });

    const res = await request(app).post('/rosters/roster-1/send-emails').set('Cookie', authCookie).send({});

    expect(res.status).toBe(404);
  });

  it('sends to every assigned staff member when staffIds is omitted', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue(rosterFixture);

    const res = await request(app).post('/rosters/roster-1/send-emails').set('Cookie', authCookie).send({});

    expect(res.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(res.body.sentTo.sort()).toEqual(['alice@b.com', 'bob@b.com']);
  });

  it('sends only to the requested staff member', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue(rosterFixture);

    const res = await request(app)
      .post('/rosters/roster-1/send-emails')
      .set('Cookie', authCookie)
      .send({ staffIds: ['staff-1'] });

    expect(res.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'alice@b.com', attachments: expect.any(Array) })
    );
    expect(res.body.sentTo).toEqual(['alice@b.com']);
  });
});
```

- [ ] **Step 6: 运行测试确认失败**

Run: `cd backend && npx vitest run src/rosters/__tests__/emailRoutes.test.ts`
Expected: FAIL — `Cannot find module '../emailRoutes'`

- [ ] **Step 7: 实现 emailRoutes.ts**

```ts
// backend/src/rosters/emailRoutes.ts
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

    await sendEmail({
      to: entry.email,
      subject: `你的排班表：${roster.name}`,
      html,
      attachments: [{ filename: `${roster.name}.ics`, content: Buffer.from(ics).toString('base64') }],
    });
    sentTo.push(entry.email);
  }

  res.json({ sentTo });
});
```

- [ ] **Step 8: 挂载到 app.ts**

```ts
// backend/src/app.ts — 顶部加 import { emailRouter } from './rosters/emailRoutes';
  app.use('/rosters', emailRouter);
```

- [ ] **Step 9: 运行测试确认通过**

Run: `cd backend && npm test`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add backend/src/email/resend.ts backend/src/email/__tests__/resend.test.ts backend/src/rosters/emailRoutes.ts backend/src/app.ts backend/src/rosters/__tests__/emailRoutes.test.ts
git commit -m "feat(backend): add roster schedule email sending with ics attachments"
```

---

### Task 5: 前端 API client 扩展（发布 / 导出 / 邮件）

**Files:**
- Modify: `frontend/src/api/client.ts`
- Test: `frontend/src/api/__tests__/client.test.ts`

**Interfaces:**
- Produces: `api.rosters.publish(id)`, `api.rosters.sendEmails(id, staffIds?)`, `api.rosters.exportUrl(id, format, staffId?)`

- [ ] **Step 1: 写失败的测试（追加）**

```ts
// frontend/src/api/__tests__/client.test.ts — 追加
describe('api.rosters publish/export/email', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('publishes a roster', async () => {
    (fetch as any).mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'roster-1', status: 'published' }) });
    await api.rosters.publish('roster-1');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/rosters/roster-1/publish'),
      expect.objectContaining({ method: 'PUT' })
    );
  });

  it('sends emails with the given staffIds', async () => {
    (fetch as any).mockResolvedValue({ ok: true, status: 200, json: async () => ({ sentTo: [] }) });
    await api.rosters.sendEmails('roster-1', ['staff-1']);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/rosters/roster-1/send-emails'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ staffIds: ['staff-1'] }) })
    );
  });

  it('builds an export url scoped to a staff member', () => {
    const url = api.rosters.exportUrl('roster-1', 'ics', 'staff-1');
    expect(url).toContain('/rosters/roster-1/export/ics');
    expect(url).toContain('staffId=staff-1');
  });

  it('builds a whole-roster export url without a staffId', () => {
    const url = api.rosters.exportUrl('roster-1', 'csv');
    expect(url).toBe(`${url.split('/rosters')[0]}/rosters/roster-1/export/csv`);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/api/__tests__/client.test.ts`
Expected: FAIL — `api.rosters.publish is undefined`

- [ ] **Step 3: 扩展 api/client.ts**

在 `api.rosters` 对象内追加：

```ts
    publish: (id: string) => apiRequest<{ id: string; status: string }>(`/rosters/${id}/publish`, { method: 'PUT' }),
    sendEmails: (id: string, staffIds?: string[]) =>
      apiRequest<{ sentTo: string[] }>(`/rosters/${id}/send-emails`, {
        method: 'POST',
        body: JSON.stringify({ staffIds }),
      }),
    exportUrl: (id: string, format: 'ics' | 'csv' | 'pdf', staffId?: string): string => {
      const base = `${API_BASE}/rosters/${id}/export/${format}`;
      return staffId ? `${base}?staffId=${staffId}` : base;
    },
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd frontend && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/client.ts frontend/src/api/__tests__/client.test.ts
git commit -m "feat(frontend): extend api client with publish, export and email methods"
```

---

### Task 6: Roster 详情页加发布 / 导出 / 发邮件 UI

**Files:**
- Modify: `frontend/src/pages/RosterDetailPage.tsx`
- Modify: `frontend/src/pages/__tests__/RosterDetailPage.test.tsx`

**Interfaces:**
- Consumes: `api.rosters.{publish, sendEmails, exportUrl}`

- [ ] **Step 1: 追加失败的测试**

```tsx
// frontend/src/pages/__tests__/RosterDetailPage.test.tsx — 在 vi.mock('../../api/client', ...) 的 rosters 里补上：
//   publish: vi.fn(), sendEmails: vi.fn(), exportUrl: vi.fn((id, format, staffId) => `/api/rosters/${id}/export/${format}${staffId ? `?staffId=${staffId}` : ''}`),
// 完整替换后的 mock 块：
vi.mock('../../api/client', () => ({
  api: {
    rosters: {
      get: vi.fn(),
      generateAssignments: vi.fn(),
      saveAssignments: vi.fn(),
      publish: vi.fn(),
      sendEmails: vi.fn(),
      exportUrl: vi.fn((id: string, format: string, staffId?: string) =>
        `/api/rosters/${id}/export/${format}${staffId ? `?staffId=${staffId}` : ''}`
      ),
    },
    groups: { listMembers: vi.fn() },
  },
}));

// 追加到文件末尾：
describe('RosterDetailPage publish and email actions', () => {
  beforeEach(() => vi.clearAllMocks());

  const renderPage = () =>
    render(
      <MemoryRouter initialEntries={['/rosters/roster-1']}>
        <Routes>
          <Route path="/rosters/:id" element={<RosterDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

  it('publishes the roster', async () => {
    (api.rosters.get as any).mockResolvedValue(baseRoster);
    (api.groups.listMembers as any).mockResolvedValue([]);
    (api.rosters.publish as any).mockResolvedValue({ id: 'roster-1', status: 'published' });

    renderPage();

    await waitFor(() => expect(screen.getByText(/Morning/)).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: '发布' }));

    await waitFor(() => expect(api.rosters.publish).toHaveBeenCalledWith('roster-1'));
    await waitFor(() => expect(screen.getByText(/published/)).toBeInTheDocument());
  });

  it('sends emails to everyone assigned', async () => {
    (api.rosters.get as any).mockResolvedValue(baseRoster);
    (api.groups.listMembers as any).mockResolvedValue([]);
    (api.rosters.sendEmails as any).mockResolvedValue({ sentTo: ['a@b.com'] });

    renderPage();

    await waitFor(() => expect(screen.getByText(/Morning/)).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: '发送邮件给全体' }));

    await waitFor(() => expect(api.rosters.sendEmails).toHaveBeenCalledWith('roster-1'));
    await waitFor(() => expect(screen.getByText(/已发送给 1 位员工/)).toBeInTheDocument());
  });
});
```

需要把已有测试文件顶部的 `baseRoster` 常量提到 describe 块之外（模块作用域），让新追加的 describe 也能引用；如果已经在模块作用域就无需改动。

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/pages/__tests__/RosterDetailPage.test.tsx`
Expected: FAIL — 找不到"发布"/"发送邮件给全体"按钮

- [ ] **Step 3: 在 RosterDetailPage.tsx 加发布/导出/邮件 UI**

在 `RosterDetailPage` 组件内，`generating` state 声明之后追加一个 state：

```tsx
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
```

在 `handleSave` 函数之后追加：

```tsx
  const handlePublish = async () => {
    if (!id) return;
    const updated = await api.rosters.publish(id);
    setRoster((prev) => (prev ? { ...prev, status: updated.status } : prev));
  };

  const handleSendAll = async () => {
    if (!id) return;
    setEmailStatus(null);
    const result = await api.rosters.sendEmails(id);
    setEmailStatus(`已发送给 ${result.sentTo.length} 位员工`);
  };

  const handleSendOne = async (staffId: string) => {
    if (!id) return;
    setEmailStatus(null);
    const result = await api.rosters.sendEmails(id, [staffId]);
    setEmailStatus(`已发送给 ${result.sentTo.length} 位员工`);
  };
```

把顶部按钮区域（`<div className="flex gap-2">...生成排班/保存按钮...</div>`）替换为：

```tsx
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="border rounded px-3 py-2 text-sm disabled:opacity-50"
          >
            {generating ? '生成中...' : '生成排班'}
          </button>
          <button
            onClick={handleSave}
            disabled={!dirty}
            className="bg-blue-600 text-white rounded px-3 py-2 text-sm disabled:opacity-50"
          >
            保存
          </button>
          <button
            onClick={handlePublish}
            disabled={roster.status === 'published'}
            className="border rounded px-3 py-2 text-sm disabled:opacity-50"
          >
            发布
          </button>
          <button onClick={handleSendAll} className="border rounded px-3 py-2 text-sm">
            发送邮件给全体
          </button>
        </div>
```

在 `{error && ...}` 之后追加导出链接和邮件状态提示：

```tsx
      {emailStatus && <p className="text-sm text-green-600">{emailStatus}</p>}
      <div className="flex gap-3 text-sm">
        <a href={api.rosters.exportUrl(roster.id, 'ics')} className="underline">
          导出 ICS
        </a>
        <a href={api.rosters.exportUrl(roster.id, 'csv')} className="underline">
          导出 CSV
        </a>
        <a href={api.rosters.exportUrl(roster.id, 'pdf')} className="underline">
          导出 PDF
        </a>
      </div>
```

在每个 assignment 行内，`{!row.staffId && (...)}` 之后追加已分配时显示的操作（同一层级的兄弟条件块）：

```tsx
                    {row.staffId && (
                      <div className="flex gap-2 text-xs">
                        <button type="button" onClick={() => handleSendOne(row.staffId!)} className="underline">
                          发送给TA
                        </button>
                        <a href={api.rosters.exportUrl(roster.id, 'ics', row.staffId)} className="underline">
                          个人ICS
                        </a>
                      </div>
                    )}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd frontend && npm test`
Expected: PASS

- [ ] **Step 5: 手动验证（浏览器）**

在一个已生成分配的排班详情页：点击"发布"，确认状态文字变为 published 且按钮变为禁用；点击"导出 ICS/CSV/PDF"，确认浏览器分别下载三个文件且内容包含已分配员工的班次；点击某一行的"个人ICS"，确认只包含该员工的班次；点击"发送邮件给全体"（需要先配置真实的 `RESEND_API_KEY`），确认目标邮箱收到含 ICS 附件的邮件，且页面显示"已发送给 N 位员工"。

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/RosterDetailPage.tsx frontend/src/pages/__tests__/RosterDetailPage.test.tsx
git commit -m "feat(frontend): add publish, export and email actions to roster detail page"
```

---

## Plan 5 完成检查

- [ ] 后端 `npm test` 全绿
- [ ] 前端 `npm test` 全绿
- [ ] 手动验证：发布状态切换、ICS/CSV/PDF 导出（整组 + 单人）、邮件发送（全体 + 单人，含 ICS 附件）全流程走通
- [ ] 所有 Task 已 commit

---

## 五份计划全部完成后的整体验收

- [ ] 从零开始跑通完整用户旅程：注册/登录 → 创建员工与小组 → 创建班次模板 → 创建 Roster → AI 生成排班 → 人工复核调整并保存 → 发布 → 导出/发送邮件
- [ ] 前后端 `npm test` 全部通过
- [ ] 在 375px 宽度（手机）下核心页面操作顺畅（spec 7）
- [ ] `.env.example` 中列出的所有环境变量在 Render 部署配置里都已设置（`DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, `GOOGLE_CLIENT_ID/SECRET/CALLBACK_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `AI_BASE_URL/API_KEY/MODEL`）
