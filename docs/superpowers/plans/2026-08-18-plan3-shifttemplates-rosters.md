# Roster Creator — Plan 3: 班次模板与 Roster 创建 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现可复用的班次模板（ShiftTemplate）CRUD，以及 Roster 创建流程——选日期范围、选员工小组、套用班次模板并逐条指定日期/人数/技能要求，生成 Roster + RosterShift 记录，并提供列表/详情页展示（不含 AI 分配，AI 分配在 Plan 4）。

**Architecture:** 后端新增 `/shift-templates` 和 `/rosters` 路由组，都在 `requireAuth` 保护下按 `userId` 隔离；Roster 创建时后端把"班次模板 × 日期"展开成多条 `RosterShift` 记录。前端新增班次模板管理页、Roster 创建表单（含逐班次的日期勾选）、Roster 列表/详情页。

**Tech Stack:** 与 Plan 1/2 相同

**Spec:** [docs/superpowers/specs/2026-08-18-roster-creator-design.md](../specs/2026-08-18-roster-creator-design.md)

**依赖：** 假定 Plan 1、Plan 2 已执行完成——`requireAuth`、`prisma`、前端 `api/client.ts`（含 `staff`/`groups`）、`App.tsx` 路由骨架、`DashboardPage` 均已存在。

## Global Constraints

- 所有资源按 `userId` 隔离，跨用户访问返回 404（spec 1, 3，同 Plan 2）
- `ShiftTemplate` 只存时间段（`startTime`/`endTime`），人数与技能要求在 `RosterShift` 层面指定（spec 3）
- 一个 `RosterShift` = 某个 Roster 中某天套用某个 ShiftTemplate 的实例；创建 Roster 时按"每个班次条目 × 每个勾选日期"生成一条 `RosterShift`（spec 5.3）
- 测试鉴权统一用 `signToken({ userId })` 生成 cookie（同 Plan 2）

---

## 文件结构总览

```
backend/src/
  shiftTemplates/
    routes.ts, __tests__/routes.test.ts
  rosters/
    routes.ts, __tests__/routes.test.ts

frontend/src/
  api/client.ts                  — modify: add shiftTemplates.*, rosters.* + types
  pages/
    ShiftTemplateListPage.tsx
    RosterCreatePage.tsx
    RosterListPage.tsx
    RosterDetailPage.tsx
    __tests__/ShiftTemplateListPage.test.tsx, RosterCreatePage.test.tsx,
              RosterListPage.test.tsx, RosterDetailPage.test.tsx
  App.tsx                        — modify: add protected routes
  pages/DashboardPage.tsx        — modify: add nav links
```

---

### Task 1: ShiftTemplate CRUD API

**Files:**
- Create: `backend/src/shiftTemplates/routes.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/src/shiftTemplates/__tests__/routes.test.ts`

**Interfaces:**
- Produces: `shiftTemplateRouter` (挂载于 `/shift-templates`): `GET /`, `POST /`, `PUT /:id`, `DELETE /:id`. 响应体：`{ id, userId, name, startTime, endTime }`

- [ ] **Step 1: 写失败的测试**

```ts
// backend/src/shiftTemplates/__tests__/routes.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../db', () => ({
  prisma: {
    shiftTemplate: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { prisma } from '../../db';
import { createApp } from '../../app';
import { signToken } from '../../auth/jwt';

const app = createApp();
const authCookie = `token=${signToken({ userId: 'user-1' })}`;

describe('GET /shift-templates', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns templates scoped to the current user', async () => {
    (prisma.shiftTemplate.findMany as any).mockResolvedValue([
      { id: 'template-1', userId: 'user-1', name: 'Morning', startTime: '06:00', endTime: '14:00' },
    ]);

    const res = await request(app).get('/shift-templates').set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(prisma.shiftTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } })
    );
    expect(res.body).toHaveLength(1);
  });
});

describe('POST /shift-templates', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a template', async () => {
    (prisma.shiftTemplate.create as any).mockResolvedValue({
      id: 'template-1',
      userId: 'user-1',
      name: 'Morning',
      startTime: '06:00',
      endTime: '14:00',
    });

    const res = await request(app)
      .post('/shift-templates')
      .set('Cookie', authCookie)
      .send({ name: 'Morning', startTime: '06:00', endTime: '14:00' });

    expect(res.status).toBe(201);
    expect(prisma.shiftTemplate.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', name: 'Morning', startTime: '06:00', endTime: '14:00' },
    });
  });

  it('rejects missing fields', async () => {
    const res = await request(app).post('/shift-templates').set('Cookie', authCookie).send({ name: 'Morning' });
    expect(res.status).toBe(400);
  });
});

describe('PUT /shift-templates/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 404 for another user\'s template', async () => {
    (prisma.shiftTemplate.findUnique as any).mockResolvedValue({ id: 'template-1', userId: 'someone-else' });

    const res = await request(app)
      .put('/shift-templates/template-1')
      .set('Cookie', authCookie)
      .send({ name: 'Hack', startTime: '00:00', endTime: '01:00' });

    expect(res.status).toBe(404);
  });

  it('updates a template owned by the current user', async () => {
    (prisma.shiftTemplate.findUnique as any).mockResolvedValue({ id: 'template-1', userId: 'user-1' });
    (prisma.shiftTemplate.update as any).mockResolvedValue({
      id: 'template-1',
      userId: 'user-1',
      name: 'Morning Shift',
      startTime: '06:00',
      endTime: '14:00',
    });

    const res = await request(app)
      .put('/shift-templates/template-1')
      .set('Cookie', authCookie)
      .send({ name: 'Morning Shift', startTime: '06:00', endTime: '14:00' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Morning Shift');
  });
});

describe('DELETE /shift-templates/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes a template owned by the current user', async () => {
    (prisma.shiftTemplate.findUnique as any).mockResolvedValue({ id: 'template-1', userId: 'user-1' });
    (prisma.shiftTemplate.delete as any).mockResolvedValue({ id: 'template-1' });

    const res = await request(app).delete('/shift-templates/template-1').set('Cookie', authCookie);

    expect(res.status).toBe(204);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && npx vitest run src/shiftTemplates/__tests__/routes.test.ts`
Expected: FAIL — `Cannot find module '../routes'`

- [ ] **Step 3: 实现 shiftTemplates/routes.ts**

```ts
// backend/src/shiftTemplates/routes.ts
import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../auth/middleware';

export const shiftTemplateRouter = Router();
shiftTemplateRouter.use(requireAuth);

shiftTemplateRouter.get('/', async (req: AuthedRequest, res) => {
  const templates = await prisma.shiftTemplate.findMany({
    where: { userId: req.userId },
    orderBy: { startTime: 'asc' },
  });
  res.json(templates);
});

shiftTemplateRouter.post('/', async (req: AuthedRequest, res) => {
  const { name, startTime, endTime } = req.body as { name?: string; startTime?: string; endTime?: string };
  if (!name || !startTime || !endTime) {
    return res.status(400).json({ error: 'Name, startTime and endTime are required' });
  }
  const template = await prisma.shiftTemplate.create({
    data: { userId: req.userId!, name, startTime, endTime },
  });
  res.status(201).json(template);
});

shiftTemplateRouter.put('/:id', async (req: AuthedRequest, res) => {
  const existing = await prisma.shiftTemplate.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.userId !== req.userId) {
    return res.status(404).json({ error: 'Shift template not found' });
  }
  const { name, startTime, endTime } = req.body as { name?: string; startTime?: string; endTime?: string };
  const template = await prisma.shiftTemplate.update({
    where: { id: req.params.id },
    data: { name, startTime, endTime },
  });
  res.json(template);
});

shiftTemplateRouter.delete('/:id', async (req: AuthedRequest, res) => {
  const existing = await prisma.shiftTemplate.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.userId !== req.userId) {
    return res.status(404).json({ error: 'Shift template not found' });
  }
  await prisma.shiftTemplate.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
```

- [ ] **Step 4: 挂载到 app.ts**

```ts
// backend/src/app.ts — 顶部加 import { shiftTemplateRouter } from './shiftTemplates/routes';
  app.use('/shift-templates', shiftTemplateRouter);
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd backend && npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/shiftTemplates/routes.ts backend/src/app.ts backend/src/shiftTemplates/__tests__/routes.test.ts
git commit -m "feat(backend): add shift template crud endpoints"
```

---

### Task 2: Roster 创建 + 列表 + 详情 API

**Files:**
- Create: `backend/src/rosters/routes.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/src/rosters/__tests__/routes.test.ts`

**Interfaces:**
- Consumes: `prisma`, `requireAuth`/`AuthedRequest`
- Produces: `rosterRouter` (挂载于 `/rosters`): `GET /` → `{ id, name, dateRangeStart, dateRangeEnd, groupId, groupName, status, shiftCount }[]`；`GET /:id` → Roster + `rosterShifts`（含 `shiftTemplate`）；`POST /` body `{ name, dateRangeStart, dateRangeEnd, groupId, shifts: [{ shiftTemplateId, dates: string[], headcount, requiredSkills }] }`，每个 `shift.dates` 中的日期都会展开成一条独立的 `RosterShift`

- [ ] **Step 1: 写失败的测试**

```ts
// backend/src/rosters/__tests__/routes.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../db', () => ({
  prisma: {
    roster: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    staffGroup: { findUnique: vi.fn() },
    shiftTemplate: { findUnique: vi.fn() },
  },
}));

import { prisma } from '../../db';
import { createApp } from '../../app';
import { signToken } from '../../auth/jwt';

const app = createApp();
const authCookie = `token=${signToken({ userId: 'user-1' })}`;

describe('GET /rosters', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists rosters scoped to the current user', async () => {
    (prisma.roster.findMany as any).mockResolvedValue([
      {
        id: 'roster-1',
        name: 'Week 34',
        dateRangeStart: new Date('2026-08-17'),
        dateRangeEnd: new Date('2026-08-23'),
        groupId: 'group-1',
        status: 'draft',
        group: { name: 'Kitchen' },
        _count: { rosterShifts: 4 },
      },
    ]);

    const res = await request(app).get('/rosters').set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({ id: 'roster-1', groupName: 'Kitchen', shiftCount: 4 });
  });
});

describe('GET /rosters/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 404 for another user\'s roster', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({ id: 'roster-1', userId: 'someone-else' });

    const res = await request(app).get('/rosters/roster-1').set('Cookie', authCookie);

    expect(res.status).toBe(404);
  });

  it('returns roster detail with shifts', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({
      id: 'roster-1',
      userId: 'user-1',
      name: 'Week 34',
      rosterShifts: [
        {
          id: 'rs-1',
          date: new Date('2026-08-17'),
          headcount: 3,
          requiredSkills: [],
          shiftTemplate: { name: 'Morning' },
        },
      ],
    });

    const res = await request(app).get('/rosters/roster-1').set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body.rosterShifts).toHaveLength(1);
  });
});

describe('POST /rosters', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects when the group does not belong to the current user', async () => {
    (prisma.staffGroup.findUnique as any).mockResolvedValue({ id: 'group-1', userId: 'someone-else' });

    const res = await request(app)
      .post('/rosters')
      .set('Cookie', authCookie)
      .send({
        name: 'Week 34',
        dateRangeStart: '2026-08-17',
        dateRangeEnd: '2026-08-23',
        groupId: 'group-1',
        shifts: [{ shiftTemplateId: 'template-1', dates: ['2026-08-17'], headcount: 2, requiredSkills: [] }],
      });

    expect(res.status).toBe(404);
  });

  it('rejects when a shift template does not belong to the current user', async () => {
    (prisma.staffGroup.findUnique as any).mockResolvedValue({ id: 'group-1', userId: 'user-1' });
    (prisma.shiftTemplate.findUnique as any).mockResolvedValue({ id: 'template-1', userId: 'someone-else' });

    const res = await request(app)
      .post('/rosters')
      .set('Cookie', authCookie)
      .send({
        name: 'Week 34',
        dateRangeStart: '2026-08-17',
        dateRangeEnd: '2026-08-23',
        groupId: 'group-1',
        shifts: [{ shiftTemplateId: 'template-1', dates: ['2026-08-17'], headcount: 2, requiredSkills: [] }],
      });

    expect(res.status).toBe(404);
  });

  it('rejects an empty shifts array', async () => {
    const res = await request(app)
      .post('/rosters')
      .set('Cookie', authCookie)
      .send({
        name: 'Week 34',
        dateRangeStart: '2026-08-17',
        dateRangeEnd: '2026-08-23',
        groupId: 'group-1',
        shifts: [],
      });

    expect(res.status).toBe(400);
  });

  it('creates a roster with one RosterShift per date per shift entry', async () => {
    (prisma.staffGroup.findUnique as any).mockResolvedValue({ id: 'group-1', userId: 'user-1' });
    (prisma.shiftTemplate.findUnique as any).mockResolvedValue({ id: 'template-1', userId: 'user-1' });
    (prisma.roster.create as any).mockResolvedValue({ id: 'roster-1' });

    const res = await request(app)
      .post('/rosters')
      .set('Cookie', authCookie)
      .send({
        name: 'Week 34',
        dateRangeStart: '2026-08-17',
        dateRangeEnd: '2026-08-23',
        groupId: 'group-1',
        shifts: [
          {
            shiftTemplateId: 'template-1',
            dates: ['2026-08-17', '2026-08-18'],
            headcount: 3,
            requiredSkills: ['cashier'],
          },
        ],
      });

    expect(res.status).toBe(201);
    const callArg = (prisma.roster.create as any).mock.calls[0][0];
    expect(callArg.data.rosterShifts.create).toHaveLength(2);
    expect(callArg.data.rosterShifts.create[0]).toMatchObject({
      shiftTemplateId: 'template-1',
      headcount: 3,
      requiredSkills: ['cashier'],
    });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && npx vitest run src/rosters/__tests__/routes.test.ts`
Expected: FAIL — `Cannot find module '../routes'`

- [ ] **Step 3: 实现 rosters/routes.ts**

```ts
// backend/src/rosters/routes.ts
import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../auth/middleware';

export const rosterRouter = Router();
rosterRouter.use(requireAuth);

interface ShiftInput {
  shiftTemplateId: string;
  dates: string[];
  headcount: number;
  requiredSkills: string[];
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
      rosterShifts: { include: { shiftTemplate: true }, orderBy: { date: 'asc' } },
      group: true,
    },
  });
  if (!roster || roster.userId !== req.userId) {
    return res.status(404).json({ error: 'Roster not found' });
  }
  res.json(roster);
});

rosterRouter.post('/', async (req: AuthedRequest, res) => {
  const { name, dateRangeStart, dateRangeEnd, groupId, shifts } = req.body as {
    name?: string;
    dateRangeStart?: string;
    dateRangeEnd?: string;
    groupId?: string;
    shifts?: ShiftInput[];
  };

  if (!name || !dateRangeStart || !dateRangeEnd || !groupId) {
    return res.status(400).json({ error: 'name, dateRangeStart, dateRangeEnd and groupId are required' });
  }
  if (!shifts || shifts.length === 0) {
    return res.status(400).json({ error: 'At least one shift is required' });
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
    if (!shift.headcount || shift.headcount < 1) {
      return res.status(400).json({ error: 'headcount must be at least 1' });
    }
  }

  const roster = await prisma.roster.create({
    data: {
      userId: req.userId!,
      name,
      dateRangeStart: new Date(dateRangeStart),
      dateRangeEnd: new Date(dateRangeEnd),
      groupId,
      rosterShifts: {
        create: shifts.flatMap((shift) =>
          shift.dates.map((date) => ({
            shiftTemplateId: shift.shiftTemplateId,
            date: new Date(date),
            headcount: shift.headcount,
            requiredSkills: shift.requiredSkills ?? [],
          }))
        ),
      },
    },
    include: { rosterShifts: true },
  });

  res.status(201).json(roster);
});
```

- [ ] **Step 4: 挂载到 app.ts**

```ts
// backend/src/app.ts — 顶部加 import { rosterRouter } from './rosters/routes';
  app.use('/rosters', rosterRouter);
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd backend && npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/rosters/routes.ts backend/src/app.ts backend/src/rosters/__tests__/routes.test.ts
git commit -m "feat(backend): add roster creation, list and detail endpoints"
```

---

### Task 3: 前端 API client 扩展（ShiftTemplate + Roster）

**Files:**
- Modify: `frontend/src/api/client.ts`
- Test: `frontend/src/api/__tests__/client.test.ts`

**Interfaces:**
- Produces: 类型 `ShiftTemplate`, `RosterShiftInput`, `RosterListItem`, `RosterShift`, `RosterDetail`；`api.shiftTemplates.{list, create, update, remove}`；`api.rosters.{list, get, create}`

- [ ] **Step 1: 写失败的测试（追加到已有文件）**

```ts
// frontend/src/api/__tests__/client.test.ts — 追加
describe('api.shiftTemplates', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('creates a shift template', async () => {
    (fetch as any).mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: 'template-1' }) });
    await api.shiftTemplates.create({ name: 'Morning', startTime: '06:00', endTime: '14:00' });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/shift-templates'),
      expect.objectContaining({ method: 'POST' })
    );
  });
});

describe('api.rosters', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('creates a roster', async () => {
    (fetch as any).mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: 'roster-1' }) });
    await api.rosters.create({
      name: 'Week 34',
      dateRangeStart: '2026-08-17',
      dateRangeEnd: '2026-08-23',
      groupId: 'group-1',
      shifts: [],
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/rosters'),
      expect.objectContaining({ method: 'POST' })
    );
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/api/__tests__/client.test.ts`
Expected: FAIL — `api.shiftTemplates is undefined`

- [ ] **Step 3: 扩展 api/client.ts**

```ts
// frontend/src/api/client.ts — 追加类型
export interface ShiftTemplate {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
}

export interface RosterShiftInput {
  shiftTemplateId: string;
  dates: string[];
  headcount: number;
  requiredSkills: string[];
}

export interface RosterListItem {
  id: string;
  name: string;
  dateRangeStart: string;
  dateRangeEnd: string;
  groupId: string;
  groupName: string;
  status: string;
  shiftCount: number;
}

export interface RosterShift {
  id: string;
  date: string;
  headcount: number;
  requiredSkills: string[];
  shiftTemplate: ShiftTemplate;
}

export interface RosterDetail {
  id: string;
  name: string;
  dateRangeStart: string;
  dateRangeEnd: string;
  groupId: string;
  status: string;
  rosterShifts: RosterShift[];
}
```

在 `export const api = { ... }` 内追加：

```ts
  shiftTemplates: {
    list: () => apiRequest<ShiftTemplate[]>('/shift-templates'),
    create: (data: { name: string; startTime: string; endTime: string }) =>
      apiRequest<ShiftTemplate>('/shift-templates', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { name: string; startTime: string; endTime: string }) =>
      apiRequest<ShiftTemplate>(`/shift-templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: string) => apiRequest<void>(`/shift-templates/${id}`, { method: 'DELETE' }),
  },
  rosters: {
    list: () => apiRequest<RosterListItem[]>('/rosters'),
    get: (id: string) => apiRequest<RosterDetail>(`/rosters/${id}`),
    create: (data: {
      name: string;
      dateRangeStart: string;
      dateRangeEnd: string;
      groupId: string;
      shifts: RosterShiftInput[];
    }) => apiRequest<RosterDetail>('/rosters', { method: 'POST', body: JSON.stringify(data) }),
  },
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd frontend && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/client.ts frontend/src/api/__tests__/client.test.ts
git commit -m "feat(frontend): extend api client with shift template and roster methods"
```

---

### Task 4: 班次模板管理页

**Files:**
- Create: `frontend/src/pages/ShiftTemplateListPage.tsx`
- Test: `frontend/src/pages/__tests__/ShiftTemplateListPage.test.tsx`

**Interfaces:**
- Consumes: `api.shiftTemplates.{list, create, remove}`

- [ ] **Step 1: 写失败的测试**

```tsx
// frontend/src/pages/__tests__/ShiftTemplateListPage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShiftTemplateListPage } from '../ShiftTemplateListPage';
import { api } from '../../api/client';

vi.mock('../../api/client', () => ({
  api: { shiftTemplates: { list: vi.fn(), create: vi.fn(), remove: vi.fn() } },
}));

describe('ShiftTemplateListPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists existing templates', async () => {
    (api.shiftTemplates.list as any).mockResolvedValue([
      { id: 'template-1', name: 'Morning', startTime: '06:00', endTime: '14:00' },
    ]);

    render(<ShiftTemplateListPage />);

    await waitFor(() => expect(screen.getByText(/Morning/)).toBeInTheDocument());
  });

  it('creates a template from the form', async () => {
    (api.shiftTemplates.list as any).mockResolvedValue([]);
    (api.shiftTemplates.create as any).mockResolvedValue({
      id: 'template-1',
      name: 'Evening',
      startTime: '14:00',
      endTime: '22:00',
    });

    render(<ShiftTemplateListPage />);

    await waitFor(() => expect(api.shiftTemplates.list).toHaveBeenCalled());
    await userEvent.type(screen.getByPlaceholderText('名称（如：早班）'), 'Evening');
    await userEvent.click(screen.getByRole('button', { name: '添加模板' }));

    await waitFor(() =>
      expect(api.shiftTemplates.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Evening' })
      )
    );
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/pages/__tests__/ShiftTemplateListPage.test.tsx`
Expected: FAIL — `Cannot find module '../ShiftTemplateListPage'`

- [ ] **Step 3: 实现 ShiftTemplateListPage.tsx**

```tsx
// frontend/src/pages/ShiftTemplateListPage.tsx
import { useEffect, useState, FormEvent } from 'react';
import { api, ShiftTemplate } from '../api/client';

export function ShiftTemplateListPage() {
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');

  const load = async () => setTemplates(await api.shiftTemplates.list());

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    await api.shiftTemplates.create({ name, startTime, endTime });
    setName('');
    await load();
  };

  const handleDelete = async (id: string) => {
    await api.shiftTemplates.remove(id);
    await load();
  };

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-xl font-semibold">班次模板</h1>
      <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-2">
        <input
          placeholder="名称（如：早班）"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border rounded px-3 py-2 flex-1"
          required
        />
        <input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          aria-label="开始时间"
          className="border rounded px-3 py-2"
          required
        />
        <input
          type="time"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          aria-label="结束时间"
          className="border rounded px-3 py-2"
          required
        />
        <button type="submit" className="bg-blue-600 text-white rounded px-4 py-2">
          添加模板
        </button>
      </form>
      <ul className="divide-y">
        {templates.map((t) => (
          <li key={t.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <span>
              {t.name}（{t.startTime} - {t.endTime}）
            </span>
            <button onClick={() => handleDelete(t.id)} className="border rounded px-3 py-1 text-sm text-red-600">
              删除
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd frontend && npx vitest run src/pages/__tests__/ShiftTemplateListPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/ShiftTemplateListPage.tsx frontend/src/pages/__tests__/ShiftTemplateListPage.test.tsx
git commit -m "feat(frontend): add shift template management page"
```

---

### Task 5: Roster 创建页

**Files:**
- Create: `frontend/src/pages/RosterCreatePage.tsx`
- Test: `frontend/src/pages/__tests__/RosterCreatePage.test.tsx`

**Interfaces:**
- Consumes: `api.shiftTemplates.list`, `api.groups.list`, `api.rosters.create`

- [ ] **Step 1: 写失败的测试**

```tsx
// frontend/src/pages/__tests__/RosterCreatePage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { RosterCreatePage } from '../RosterCreatePage';
import { api } from '../../api/client';

vi.mock('../../api/client', () => ({
  api: {
    shiftTemplates: { list: vi.fn() },
    groups: { list: vi.fn() },
    rosters: { create: vi.fn() },
  },
}));

describe('RosterCreatePage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a roster with the selected shift and dates', async () => {
    (api.shiftTemplates.list as any).mockResolvedValue([
      { id: 'template-1', name: 'Morning', startTime: '06:00', endTime: '14:00' },
    ]);
    (api.groups.list as any).mockResolvedValue([{ id: 'group-1', name: 'Kitchen', memberCount: 2 }]);
    (api.rosters.create as any).mockResolvedValue({ id: 'roster-1' });

    render(
      <MemoryRouter>
        <RosterCreatePage />
      </MemoryRouter>
    );

    await waitFor(() => expect(api.shiftTemplates.list).toHaveBeenCalled());

    await userEvent.type(screen.getByPlaceholderText('排班名称'), 'Week 34');
    fireEvent.change(screen.getByLabelText('开始日期'), { target: { value: '2026-08-17' } });
    fireEvent.change(screen.getByLabelText('结束日期'), { target: { value: '2026-08-18' } });
    await userEvent.selectOptions(screen.getByLabelText('员工小组'), 'group-1');

    await userEvent.click(screen.getByRole('button', { name: '添加班次' }));
    await userEvent.selectOptions(screen.getByLabelText('班次模板'), 'template-1');

    const dateCheckbox = await screen.findByLabelText('2026-08-17');
    await userEvent.click(dateCheckbox);

    await userEvent.click(screen.getByRole('button', { name: '创建排班' }));

    await waitFor(() =>
      expect(api.rosters.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Week 34',
          dateRangeStart: '2026-08-17',
          dateRangeEnd: '2026-08-18',
          groupId: 'group-1',
          shifts: [expect.objectContaining({ shiftTemplateId: 'template-1', dates: ['2026-08-17'], headcount: 1 })],
        })
      )
    );
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/pages/__tests__/RosterCreatePage.test.tsx`
Expected: FAIL — `Cannot find module '../RosterCreatePage'`

- [ ] **Step 3: 实现 RosterCreatePage.tsx**

```tsx
// frontend/src/pages/RosterCreatePage.tsx
import { useEffect, useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ShiftTemplate, StaffGroup } from '../api/client';

interface ShiftRow {
  shiftTemplateId: string;
  headcount: number;
  requiredSkills: string;
  dates: string[];
}

function datesBetween(start: string, end: string): string[] {
  if (!start || !end) return [];
  const dates: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor <= last) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export function RosterCreatePage() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [groups, setGroups] = useState<StaffGroup[]>([]);
  const [name, setName] = useState('');
  const [dateRangeStart, setDateRangeStart] = useState('');
  const [dateRangeEnd, setDateRangeEnd] = useState('');
  const [groupId, setGroupId] = useState('');
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.shiftTemplates.list().then(setTemplates);
    api.groups.list().then(setGroups);
  }, []);

  const availableDates = datesBetween(dateRangeStart, dateRangeEnd);

  const addShiftRow = () => {
    if (templates.length === 0) return;
    setShifts((prev) => [...prev, { shiftTemplateId: templates[0].id, headcount: 1, requiredSkills: '', dates: [] }]);
  };

  const updateShiftRow = (index: number, patch: Partial<ShiftRow>) => {
    setShifts((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const toggleDate = (index: number, date: string) => {
    setShifts((prev) =>
      prev.map((s, i) => {
        if (i !== index) return s;
        const dates = s.dates.includes(date) ? s.dates.filter((d) => d !== date) : [...s.dates, date];
        return { ...s, dates };
      })
    );
  };

  const removeShiftRow = (index: number) => {
    setShifts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const roster = await api.rosters.create({
        name,
        dateRangeStart,
        dateRangeEnd,
        groupId,
        shifts: shifts.map((s) => ({
          shiftTemplateId: s.shiftTemplateId,
          headcount: s.headcount,
          requiredSkills: s.requiredSkills
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean),
          dates: s.dates,
        })),
      });
      navigate(`/rosters/${roster.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create roster');
    }
  };

  return (
    <div className="p-4 max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">创建排班</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <p role="alert" className="text-red-600 text-sm">
            {error}
          </p>
        )}
        <input
          placeholder="排班名称"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border rounded px-3 py-2"
          required
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            value={dateRangeStart}
            onChange={(e) => setDateRangeStart(e.target.value)}
            aria-label="开始日期"
            className="border rounded px-3 py-2"
            required
          />
          <input
            type="date"
            value={dateRangeEnd}
            onChange={(e) => setDateRangeEnd(e.target.value)}
            aria-label="结束日期"
            className="border rounded px-3 py-2"
            required
          />
        </div>
        <select
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
          aria-label="员工小组"
          className="w-full border rounded px-3 py-2"
          required
        >
          <option value="">选择员工小组</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">班次安排</h2>
            <button type="button" onClick={addShiftRow} className="border rounded px-3 py-1 text-sm">
              添加班次
            </button>
          </div>
          {shifts.map((shift, index) => (
            <div key={index} className="border rounded p-3 space-y-2">
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={shift.shiftTemplateId}
                  onChange={(e) => updateShiftRow(index, { shiftTemplateId: e.target.value })}
                  aria-label="班次模板"
                  className="border rounded px-3 py-2 flex-1"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}（{t.startTime}-{t.endTime}）
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={shift.headcount}
                  onChange={(e) => updateShiftRow(index, { headcount: Number(e.target.value) })}
                  aria-label="所需人数"
                  className="border rounded px-3 py-2 w-24"
                />
                <input
                  placeholder="所需技能（逗号分隔）"
                  value={shift.requiredSkills}
                  onChange={(e) => updateShiftRow(index, { requiredSkills: e.target.value })}
                  className="border rounded px-3 py-2 flex-1"
                />
                <button type="button" onClick={() => removeShiftRow(index)} className="text-red-600 text-sm">
                  移除
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {availableDates.map((date) => (
                  <label key={date} className="text-xs flex items-center gap-1 border rounded px-2 py-1">
                    <input type="checkbox" checked={shift.dates.includes(date)} onChange={() => toggleDate(index, date)} />
                    {date}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button type="submit" className="bg-blue-600 text-white rounded px-4 py-2">
          创建排班
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd frontend && npx vitest run src/pages/__tests__/RosterCreatePage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/RosterCreatePage.tsx frontend/src/pages/__tests__/RosterCreatePage.test.tsx
git commit -m "feat(frontend): add roster creation page"
```

---

### Task 6: Roster 列表页 + 详情页 + 路由整合

**Files:**
- Create: `frontend/src/pages/RosterListPage.tsx`
- Create: `frontend/src/pages/RosterDetailPage.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Test: `frontend/src/pages/__tests__/RosterListPage.test.tsx`
- Test: `frontend/src/pages/__tests__/RosterDetailPage.test.tsx`

**Interfaces:**
- Consumes: `api.rosters.{list, get}`

- [ ] **Step 1: 写失败的 RosterListPage 测试**

```tsx
// frontend/src/pages/__tests__/RosterListPage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RosterListPage } from '../RosterListPage';
import { api } from '../../api/client';

vi.mock('../../api/client', () => ({
  api: { rosters: { list: vi.fn() } },
}));

describe('RosterListPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists existing rosters', async () => {
    (api.rosters.list as any).mockResolvedValue([
      {
        id: 'roster-1',
        name: 'Week 34',
        dateRangeStart: '2026-08-17T00:00:00.000Z',
        dateRangeEnd: '2026-08-23T00:00:00.000Z',
        groupId: 'group-1',
        groupName: 'Kitchen',
        status: 'draft',
        shiftCount: 4,
      },
    ]);

    render(
      <MemoryRouter>
        <RosterListPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Week 34')).toBeInTheDocument());
    expect(screen.getByText(/Kitchen/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/pages/__tests__/RosterListPage.test.tsx`
Expected: FAIL — `Cannot find module '../RosterListPage'`

- [ ] **Step 3: 实现 RosterListPage.tsx**

```tsx
// frontend/src/pages/RosterListPage.tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, RosterListItem } from '../api/client';

export function RosterListPage() {
  const [rosters, setRosters] = useState<RosterListItem[]>([]);

  useEffect(() => {
    api.rosters.list().then(setRosters);
  }, []);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">排班表</h1>
        <Link to="/rosters/new" className="bg-blue-600 text-white rounded px-4 py-2 text-sm">
          创建排班
        </Link>
      </div>
      <ul className="divide-y">
        {rosters.map((r) => (
          <li key={r.id} className="py-3">
            <Link to={`/rosters/${r.id}`} className="font-medium underline">
              {r.name}
            </Link>
            <p className="text-sm text-gray-500">
              {r.groupName} · {r.dateRangeStart.slice(0, 10)} ~ {r.dateRangeEnd.slice(0, 10)} · {r.shiftCount} 个班次 ·{' '}
              {r.status}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd frontend && npx vitest run src/pages/__tests__/RosterListPage.test.tsx`
Expected: PASS

- [ ] **Step 5: 写失败的 RosterDetailPage 测试**

```tsx
// frontend/src/pages/__tests__/RosterDetailPage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RosterDetailPage } from '../RosterDetailPage';
import { api } from '../../api/client';

vi.mock('../../api/client', () => ({
  api: { rosters: { get: vi.fn() } },
}));

describe('RosterDetailPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the roster shifts', async () => {
    (api.rosters.get as any).mockResolvedValue({
      id: 'roster-1',
      name: 'Week 34',
      dateRangeStart: '2026-08-17T00:00:00.000Z',
      dateRangeEnd: '2026-08-23T00:00:00.000Z',
      groupId: 'group-1',
      status: 'draft',
      rosterShifts: [
        {
          id: 'rs-1',
          date: '2026-08-17T00:00:00.000Z',
          headcount: 3,
          requiredSkills: ['cashier'],
          shiftTemplate: { id: 'template-1', name: 'Morning', startTime: '06:00', endTime: '14:00' },
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={['/rosters/roster-1']}>
        <Routes>
          <Route path="/rosters/:id" element={<RosterDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText(/Morning/)).toBeInTheDocument());
    expect(screen.getByText(/需要 3 人/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/pages/__tests__/RosterDetailPage.test.tsx`
Expected: FAIL — `Cannot find module '../RosterDetailPage'`

- [ ] **Step 7: 实现 RosterDetailPage.tsx**

```tsx
// frontend/src/pages/RosterDetailPage.tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, RosterDetail } from '../api/client';

export function RosterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [roster, setRoster] = useState<RosterDetail | null>(null);

  useEffect(() => {
    if (!id) return;
    api.rosters.get(id).then(setRoster);
  }, [id]);

  if (!roster) return <div className="p-4">加载中...</div>;

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">{roster.name}</h1>
      <p className="text-sm text-gray-500">
        {roster.dateRangeStart.slice(0, 10)} ~ {roster.dateRangeEnd.slice(0, 10)} · 状态：{roster.status}
      </p>
      <ul className="divide-y">
        {roster.rosterShifts.map((rs) => (
          <li key={rs.id} className="py-3">
            <p className="font-medium">
              {rs.date.slice(0, 10)} · {rs.shiftTemplate.name}（{rs.shiftTemplate.startTime}-{rs.shiftTemplate.endTime}）
            </p>
            <p className="text-sm text-gray-500">
              需要 {rs.headcount} 人{rs.requiredSkills.length > 0 ? ` · 技能: ${rs.requiredSkills.join(', ')}` : ''}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 8: 挂载路由到 App.tsx**

```tsx
// frontend/src/App.tsx — 顶部追加 import：
import { ShiftTemplateListPage } from './pages/ShiftTemplateListPage';
import { RosterCreatePage } from './pages/RosterCreatePage';
import { RosterListPage } from './pages/RosterListPage';
import { RosterDetailPage } from './pages/RosterDetailPage';

// 在已有的 /groups/:id 路由之后追加（/rosters/new 必须和 /rosters/:id 都存在，React Router 会优先匹配静态路径）：
        <Route
          path="/shift-templates"
          element={
            <ProtectedRoute>
              <ShiftTemplateListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/rosters"
          element={
            <ProtectedRoute>
              <RosterListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/rosters/new"
          element={
            <ProtectedRoute>
              <RosterCreatePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/rosters/:id"
          element={
            <ProtectedRoute>
              <RosterDetailPage />
            </ProtectedRoute>
          }
        />
```

- [ ] **Step 9: 在 DashboardPage 加导航链接**

```tsx
// frontend/src/pages/DashboardPage.tsx — nav 区域内追加两个 Link（放在已有的 员工管理/小组管理 链接之后）
        <Link to="/shift-templates" className="underline">
          班次模板
        </Link>
        <Link to="/rosters" className="underline">
          排班表
        </Link>
```

- [ ] **Step 10: 运行全部前端测试确认通过**

Run: `cd frontend && npm test`
Expected: PASS

- [ ] **Step 11: 手动验证（浏览器）**

打开 `/shift-templates` 创建 1-2 个班次模板；打开 `/rosters/new`，填写名称、日期范围、选择小组，添加一个班次条目、勾选几个日期、指定人数和技能后提交，应跳转到 `/rosters/:id` 并看到刚创建的所有 RosterShift；返回 `/rosters` 确认列表里能看到这份排班。

- [ ] **Step 12: Commit**

```bash
git add frontend/src/pages/RosterListPage.tsx frontend/src/pages/RosterDetailPage.tsx frontend/src/App.tsx frontend/src/pages/DashboardPage.tsx frontend/src/pages/__tests__/RosterListPage.test.tsx frontend/src/pages/__tests__/RosterDetailPage.test.tsx
git commit -m "feat(frontend): add roster list/detail pages and wire up navigation"
```

---

## Plan 3 完成检查

- [ ] 后端 `npm test` 全绿
- [ ] 前端 `npm test` 全绿
- [ ] 手动验证：班次模板增删、Roster 创建（含多日期展开）、列表与详情展示全流程走通
- [ ] 所有 Task 已 commit
