# Roster Creator — Plan 4: AI 自动分配 + 人工复核编辑 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现可插拔的 AI 分配适配层，调用 AI 把小组员工分配到 Roster 的各个班次坑位；在 Roster 详情页提供人工复核/调整界面（换人、清空、打标签），改动先停留在前端本地状态，显式点击"保存"才写入数据库。

**Architecture:** 后端新增 `AIProvider` 适配层（`assignShifts(context)`），走 OpenAI 兼容的 Chat Completions HTTP 接口，所有连接参数走环境变量；`POST /rosters/:id/generate-assignments` 触发 AI 分配并整批写入 `Assignment` 表（先删后建，保证幂等）；`PUT /rosters/:id/assignments` 承载人工编辑后的批量保存。前端 `RosterDetailPage` 从 Plan 3 的只读视图升级为可编辑视图，用本地 state 暂存改动，`dirty` 标记控制"保存"按钮可用性和离开前的 `beforeunload` 提示。

**Tech Stack:** 与 Plan 1-3 相同，新增全局 `fetch` 调用外部 AI HTTP 接口

**Spec:** [docs/superpowers/specs/2026-08-18-roster-creator-design.md](../specs/2026-08-18-roster-creator-design.md)

**依赖：** 假定 Plan 1-3 已执行完成——`requireAuth`、`prisma`、`rosterRouter`（`GET/POST /rosters`, `GET /rosters/:id`）、前端 `api/client.ts`（含 `rosters`/`groups`/`staff`）、`RosterDetailPage`（Plan 3 的只读版本，本计划会修改它）均已存在。

## Global Constraints

- AI 连接参数（`AI_BASE_URL`/`AI_API_KEY`/`AI_MODEL`）全部走环境变量，代码不写死供应商（spec 6）
- 分配优先级：先保证 `minHoursPerWeek` → 再满足 preference（偏好时段/星期几/不可用日期）→ 再做技能匹配（spec 5.4）
- AI 调用失败或返回非法结果：整批分配标记失败，不写入任何 `Assignment` 变更，前端提示用户重试或转手动排班，不自动重试、不回退规则算法（spec 5.4, 8）
- 人工复核的改动只停留在前端本地状态，必须点击"保存"才提交到后端；未保存关闭/刷新页面需提示确认（spec 5.5）
- 未分配坑位可打预置标签 AGENT/PICKUP 或自定义文本（spec 5.4, 5.5）

---

## 文件结构总览

```
backend/src/
  ai/
    provider.ts               — AIProvider 接口 + OpenAICompatibleProvider 实现
    __tests__/provider.test.ts
  rosters/
    routes.ts                  — modify: GET /:id 的 include 里加 assignments
    assignmentRoutes.ts        — POST /:id/generate-assignments, PUT /:id/assignments
    __tests__/assignmentRoutes.test.ts

frontend/src/
  api/client.ts                — modify: 加 AssignmentEntry 类型、RosterShift 加 assignments 字段、
                                  api.rosters.generateAssignments/saveAssignments
  pages/
    RosterDetailPage.tsx       — modify: 从只读视图升级为可编辑复核界面
    __tests__/RosterDetailPage.test.tsx — modify
```

---

### Task 1: AI Provider 适配层

**Files:**
- Create: `backend/src/ai/provider.ts`
- Test: `backend/src/ai/__tests__/provider.test.ts`

**Interfaces:**
- Produces: `AssignmentContext`, `AssignmentResult`, `AIProvider` 接口；`OpenAICompatibleProvider` 类；`aiProvider: AIProvider` 单例（供 Task 2 使用）

- [ ] **Step 1: 写失败的测试**

```ts
// backend/src/ai/__tests__/provider.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAICompatibleProvider } from '../provider';

describe('OpenAICompatibleProvider', () => {
  const originalEnv = { ...process.env };
  const context = { shifts: [], staff: [] };

  beforeEach(() => {
    process.env.AI_BASE_URL = 'https://api.example.com/v1';
    process.env.AI_API_KEY = 'test-key';
    process.env.AI_MODEL = 'test-model';
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it('parses a valid assignment result', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          { message: { content: JSON.stringify({ assignments: [{ rosterShiftId: 'rs-1', staffIds: ['staff-1'] }] }) } },
        ],
      }),
    });

    const provider = new OpenAICompatibleProvider();
    const result = await provider.assignShifts(context);

    expect(result.assignments).toEqual([{ rosterShiftId: 'rs-1', staffIds: ['staff-1'] }]);
  });

  it('throws when the http request fails', async () => {
    (fetch as any).mockResolvedValue({ ok: false, status: 500 });

    const provider = new OpenAICompatibleProvider();
    await expect(provider.assignShifts(context)).rejects.toThrow('status 500');
  });

  it('throws when the response content is not valid JSON', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'not json' } }] }),
    });

    const provider = new OpenAICompatibleProvider();
    await expect(provider.assignShifts(context)).rejects.toThrow('invalid JSON');
  });

  it('throws when the response shape is unexpected', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ foo: 'bar' }) } }] }),
    });

    const provider = new OpenAICompatibleProvider();
    await expect(provider.assignShifts(context)).rejects.toThrow('unexpected response shape');
  });

  it('throws when required env vars are missing', async () => {
    delete process.env.AI_BASE_URL;

    const provider = new OpenAICompatibleProvider();
    await expect(provider.assignShifts(context)).rejects.toThrow('not configured');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && npx vitest run src/ai/__tests__/provider.test.ts`
Expected: FAIL — `Cannot find module '../provider'`

- [ ] **Step 3: 实现 provider.ts**

```ts
// backend/src/ai/provider.ts
export interface AssignmentContextShift {
  rosterShiftId: string;
  date: string;
  startTime: string;
  endTime: string;
  headcount: number;
  requiredSkills: string[];
}

export interface AssignmentContextStaff {
  staffId: string;
  name: string;
  skills: string[];
  minHoursPerWeek: number;
  maxHoursPerWeek: number;
  preferredShiftTemplateIds: string[];
  preferredWeekdays: number[];
  unavailableDateRanges: { start: string; end: string }[];
}

export interface AssignmentContext {
  shifts: AssignmentContextShift[];
  staff: AssignmentContextStaff[];
}

export interface AssignmentResultEntry {
  rosterShiftId: string;
  staffIds: string[];
}

export interface AssignmentResult {
  assignments: AssignmentResultEntry[];
}

export interface AIProvider {
  assignShifts(context: AssignmentContext): Promise<AssignmentResult>;
}

function buildPrompt(context: AssignmentContext): string {
  return [
    '你是一个排班助手。请根据以下班次需求和员工信息，把员工分配到班次。',
    '分配优先级：1) 优先保证每位员工达到 minHoursPerWeek 的最低工时；',
    '2) 再满足员工的 preferredShiftTemplateIds/preferredWeekdays 偏好，并避开 unavailableDateRanges；',
    '3) 再尽量匹配 requiredSkills。',
    '每个班次分配的人数不能超过 headcount，也不能把同一个员工分配到同一天的多个班次。',
    '如果员工不够，允许某个班次分配不满，不要虚构不存在的员工 id。',
    '只输出 JSON，不要输出任何解释文字，格式为：',
    '{"assignments":[{"rosterShiftId":"...","staffIds":["..."]}]}',
    '',
    `班次列表：${JSON.stringify(context.shifts)}`,
    `员工列表：${JSON.stringify(context.staff)}`,
  ].join('\n');
}

function isValidResult(value: unknown): value is AssignmentResult {
  if (!value || typeof value !== 'object') return false;
  const assignments = (value as { assignments?: unknown }).assignments;
  if (!Array.isArray(assignments)) return false;
  return assignments.every(
    (a) =>
      a &&
      typeof a === 'object' &&
      typeof (a as any).rosterShiftId === 'string' &&
      Array.isArray((a as any).staffIds) &&
      (a as any).staffIds.every((id: unknown) => typeof id === 'string')
  );
}

export class OpenAICompatibleProvider implements AIProvider {
  async assignShifts(context: AssignmentContext): Promise<AssignmentResult> {
    const baseUrl = process.env.AI_BASE_URL;
    const apiKey = process.env.AI_API_KEY;
    const model = process.env.AI_MODEL;
    if (!baseUrl || !apiKey || !model) {
      throw new Error('AI provider is not configured (AI_BASE_URL/AI_API_KEY/AI_MODEL)');
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: buildPrompt(context) }],
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      throw new Error(`AI provider request failed with status ${response.status}`);
    }

    const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const content = body.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('AI provider returned no content');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error('AI provider returned invalid JSON');
    }

    if (!isValidResult(parsed)) {
      throw new Error('AI provider returned an unexpected response shape');
    }

    return parsed;
  }
}

export const aiProvider: AIProvider = new OpenAICompatibleProvider();
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd backend && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/ai/provider.ts backend/src/ai/__tests__/provider.test.ts
git commit -m "feat(backend): add pluggable ai provider for shift assignment"
```

---

### Task 2: AI 自动分配端点

**Files:**
- Create: `backend/src/rosters/assignmentRoutes.ts`
- Modify: `backend/src/rosters/routes.ts`（`GET /:id` 的 include 里加 `assignments`）
- Modify: `backend/src/app.ts`
- Test: `backend/src/rosters/__tests__/assignmentRoutes.test.ts`

**Interfaces:**
- Consumes: `prisma`, `requireAuth`/`AuthedRequest`, `aiProvider` from `../ai/provider`
- Produces: `assignmentRouter`（挂载于 `/rosters`）的 `POST /:id/generate-assignments`，返回 `{ assignments: Assignment[] }`（含 `staff` 关联）

- [ ] **Step 1: 修改 rosters/routes.ts 的 GET /:id**

```ts
// backend/src/rosters/routes.ts — 把 GET /:id 里的 include 替换为：
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
```

- [ ] **Step 2: 写失败的测试**

```ts
// backend/src/rosters/__tests__/assignmentRoutes.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../db', () => ({
  prisma: {
    roster: { findUnique: vi.fn() },
    assignment: { deleteMany: vi.fn(), createMany: vi.fn(), findMany: vi.fn() },
  },
}));
vi.mock('../../ai/provider', () => ({ aiProvider: { assignShifts: vi.fn() } }));

import { prisma } from '../../db';
import { aiProvider } from '../../ai/provider';
import { createApp } from '../../app';
import { signToken } from '../../auth/jwt';

const app = createApp();
const authCookie = `token=${signToken({ userId: 'user-1' })}`;

const rosterFixture = {
  id: 'roster-1',
  userId: 'user-1',
  rosterShifts: [
    {
      id: 'rs-1',
      headcount: 2,
      requiredSkills: [],
      date: new Date('2026-08-17'),
      shiftTemplate: { startTime: '06:00', endTime: '14:00' },
    },
  ],
  group: {
    members: [
      {
        staff: {
          id: 'staff-1',
          name: 'Alice',
          skills: [],
          preference: { minHoursPerWeek: 10, maxHoursPerWeek: 30, preferredShiftTemplateIds: [], preferredWeekdays: [], unavailableDateRanges: [] },
        },
      },
    ],
  },
};

describe('POST /rosters/:id/generate-assignments', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 404 for another user\'s roster', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({ id: 'roster-1', userId: 'someone-else' });

    const res = await request(app).post('/rosters/roster-1/generate-assignments').set('Cookie', authCookie);

    expect(res.status).toBe(404);
  });

  it('returns 502 and makes no db changes when the ai provider fails', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue(rosterFixture);
    (aiProvider.assignShifts as any).mockRejectedValue(new Error('AI provider is not configured'));

    const res = await request(app).post('/rosters/roster-1/generate-assignments').set('Cookie', authCookie);

    expect(res.status).toBe(502);
    expect(prisma.assignment.deleteMany).not.toHaveBeenCalled();
    expect(prisma.assignment.createMany).not.toHaveBeenCalled();
  });

  it('replaces assignments and fills unfilled slots when ai returns fewer staff than headcount', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue(rosterFixture);
    (aiProvider.assignShifts as any).mockResolvedValue({
      assignments: [{ rosterShiftId: 'rs-1', staffIds: ['staff-1'] }],
    });
    (prisma.assignment.findMany as any).mockResolvedValue([
      { id: 'a-1', rosterShiftId: 'rs-1', staffId: 'staff-1', unfilledTag: null, staff: { id: 'staff-1', name: 'Alice' } },
      { id: 'a-2', rosterShiftId: 'rs-1', staffId: null, unfilledTag: null, staff: null },
    ]);

    const res = await request(app).post('/rosters/roster-1/generate-assignments').set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(prisma.assignment.deleteMany).toHaveBeenCalledWith({ where: { rosterShiftId: { in: ['rs-1'] } } });
    const createArg = (prisma.assignment.createMany as any).mock.calls[0][0];
    expect(createArg.data).toHaveLength(2);
    expect(createArg.data.filter((r: any) => r.staffId === 'staff-1')).toHaveLength(1);
    expect(createArg.data.filter((r: any) => r.staffId === null)).toHaveLength(1);
    expect(res.body.assignments).toHaveLength(2);
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `cd backend && npx vitest run src/rosters/__tests__/assignmentRoutes.test.ts`
Expected: FAIL — `Cannot find module '../assignmentRoutes'`

- [ ] **Step 4: 实现 assignmentRoutes.ts**

```ts
// backend/src/rosters/assignmentRoutes.ts
import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../auth/middleware';
import { aiProvider, AssignmentContext } from '../ai/provider';

export const assignmentRouter = Router();
assignmentRouter.use(requireAuth);

assignmentRouter.post('/:id/generate-assignments', async (req: AuthedRequest, res) => {
  const roster = await prisma.roster.findUnique({
    where: { id: req.params.id },
    include: {
      rosterShifts: { include: { shiftTemplate: true } },
      group: { include: { members: { include: { staff: { include: { preference: true } } } } } },
    },
  });
  if (!roster || roster.userId !== req.userId) {
    return res.status(404).json({ error: 'Roster not found' });
  }

  const context: AssignmentContext = {
    shifts: roster.rosterShifts.map((rs) => ({
      rosterShiftId: rs.id,
      date: rs.date.toISOString().slice(0, 10),
      startTime: rs.shiftTemplate.startTime,
      endTime: rs.shiftTemplate.endTime,
      headcount: rs.headcount,
      requiredSkills: rs.requiredSkills,
    })),
    staff: roster.group.members.map((m) => ({
      staffId: m.staff.id,
      name: m.staff.name,
      skills: m.staff.skills,
      minHoursPerWeek: m.staff.preference?.minHoursPerWeek ?? 0,
      maxHoursPerWeek: m.staff.preference?.maxHoursPerWeek ?? 40,
      preferredShiftTemplateIds: m.staff.preference?.preferredShiftTemplateIds ?? [],
      preferredWeekdays: m.staff.preference?.preferredWeekdays ?? [],
      unavailableDateRanges: (m.staff.preference?.unavailableDateRanges as { start: string; end: string }[]) ?? [],
    })),
  };

  let result;
  try {
    result = await aiProvider.assignShifts(context);
  } catch (err) {
    return res.status(502).json({ error: err instanceof Error ? err.message : 'AI provider failed' });
  }

  const shiftIds = roster.rosterShifts.map((rs) => rs.id);
  const resultByShift = new Map(result.assignments.map((a) => [a.rosterShiftId, a.staffIds]));

  await prisma.assignment.deleteMany({ where: { rosterShiftId: { in: shiftIds } } });

  const rows = roster.rosterShifts.flatMap((rs) => {
    const staffIds = resultByShift.get(rs.id) ?? [];
    const filled = staffIds
      .slice(0, rs.headcount)
      .map((staffId) => ({ rosterShiftId: rs.id, staffId, unfilledTag: null as string | null }));
    const unfilledCount = rs.headcount - filled.length;
    const unfilled = Array.from({ length: Math.max(unfilledCount, 0) }, () => ({
      rosterShiftId: rs.id,
      staffId: null as string | null,
      unfilledTag: null as string | null,
    }));
    return [...filled, ...unfilled];
  });

  await prisma.assignment.createMany({ data: rows });

  const assignments = await prisma.assignment.findMany({
    where: { rosterShiftId: { in: shiftIds } },
    include: { staff: true },
  });

  res.json({ assignments });
});
```

- [ ] **Step 5: 挂载到 app.ts**

```ts
// backend/src/app.ts — 顶部加 import { assignmentRouter } from './rosters/assignmentRoutes';
// 在 app.use('/rosters', rosterRouter) 之后加：
  app.use('/rosters', assignmentRouter);
```

- [ ] **Step 6: 运行测试确认通过**

Run: `cd backend && npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/src/rosters/assignmentRoutes.ts backend/src/rosters/routes.ts backend/src/app.ts backend/src/rosters/__tests__/assignmentRoutes.test.ts
git commit -m "feat(backend): add ai-driven shift assignment generation"
```

---

### Task 3: 人工复核批量保存端点

**Files:**
- Modify: `backend/src/rosters/assignmentRoutes.ts`
- Test: `backend/src/rosters/__tests__/assignmentRoutes.test.ts`

**Interfaces:**
- Produces: `PUT /rosters/:id/assignments`，body `{ assignments: { id: string; staffId: string | null; unfilledTag: string | null }[] }`，返回 `{ assignments: Assignment[] }`

- [ ] **Step 1: 追加失败的测试**

```ts
// backend/src/rosters/__tests__/assignmentRoutes.test.ts — 在 vi.mock('../../db', ...) 里的 prisma mock 追加：
//   roster: { findUnique: vi.fn() },
//   rosterShift: { findMany: vi.fn() },
//   assignment: { deleteMany: vi.fn(), createMany: vi.fn(), findMany: vi.fn(), update: vi.fn() },
// 完整替换后的 vi.mock 块：
vi.mock('../../db', () => ({
  prisma: {
    roster: { findUnique: vi.fn() },
    rosterShift: { findMany: vi.fn() },
    assignment: { deleteMany: vi.fn(), createMany: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  },
}));

// 追加到文件末尾：
describe('PUT /rosters/:id/assignments', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 404 for another user\'s roster', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({ id: 'roster-1', userId: 'someone-else' });

    const res = await request(app)
      .put('/rosters/roster-1/assignments')
      .set('Cookie', authCookie)
      .send({ assignments: [{ id: 'a-1', staffId: 'staff-1', unfilledTag: null }] });

    expect(res.status).toBe(404);
  });

  it('rejects an assignment that does not belong to this roster', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({ id: 'roster-1', userId: 'user-1' });
    (prisma.rosterShift.findMany as any).mockResolvedValue([{ id: 'rs-1' }]);
    (prisma.assignment.findMany as any).mockResolvedValue([{ id: 'a-1', rosterShiftId: 'rs-other' }]);

    const res = await request(app)
      .put('/rosters/roster-1/assignments')
      .set('Cookie', authCookie)
      .send({ assignments: [{ id: 'a-1', staffId: 'staff-1', unfilledTag: null }] });

    expect(res.status).toBe(404);
    expect(prisma.assignment.update).not.toHaveBeenCalled();
  });

  it('updates each assignment and returns the refreshed list', async () => {
    (prisma.roster.findUnique as any).mockResolvedValue({ id: 'roster-1', userId: 'user-1' });
    (prisma.rosterShift.findMany as any).mockResolvedValue([{ id: 'rs-1' }]);
    (prisma.assignment.findMany as any)
      .mockResolvedValueOnce([{ id: 'a-1', rosterShiftId: 'rs-1' }])
      .mockResolvedValueOnce([{ id: 'a-1', rosterShiftId: 'rs-1', staffId: 'staff-2', unfilledTag: null, staff: { id: 'staff-2', name: 'Bob' } }]);
    (prisma.assignment.update as any).mockResolvedValue({});

    const res = await request(app)
      .put('/rosters/roster-1/assignments')
      .set('Cookie', authCookie)
      .send({ assignments: [{ id: 'a-1', staffId: 'staff-2', unfilledTag: null }] });

    expect(res.status).toBe(200);
    expect(prisma.assignment.update).toHaveBeenCalledWith({
      where: { id: 'a-1' },
      data: { staffId: 'staff-2', unfilledTag: null },
    });
    expect(res.body.assignments[0].staffId).toBe('staff-2');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && npx vitest run src/rosters/__tests__/assignmentRoutes.test.ts`
Expected: FAIL — `PUT /rosters/:id/assignments` 路由不存在，返回 404 但断言的 mock 调用不匹配

- [ ] **Step 3: 追加 PUT 处理器到 assignmentRoutes.ts**

```ts
// backend/src/rosters/assignmentRoutes.ts — 追加到文件末尾
assignmentRouter.put('/:id/assignments', async (req: AuthedRequest, res) => {
  const roster = await prisma.roster.findUnique({ where: { id: req.params.id } });
  if (!roster || roster.userId !== req.userId) {
    return res.status(404).json({ error: 'Roster not found' });
  }

  const { assignments } = req.body as {
    assignments?: { id: string; staffId: string | null; unfilledTag: string | null }[];
  };
  if (!assignments) {
    return res.status(400).json({ error: 'assignments is required' });
  }

  const rosterShifts = await prisma.rosterShift.findMany({
    where: { rosterId: req.params.id },
    select: { id: true },
  });
  const rosterShiftIds = new Set(rosterShifts.map((rs) => rs.id));

  const existing = await prisma.assignment.findMany({ where: { id: { in: assignments.map((a) => a.id) } } });
  const ownedIds = new Set(existing.filter((a) => rosterShiftIds.has(a.rosterShiftId)).map((a) => a.id));

  for (const a of assignments) {
    if (!ownedIds.has(a.id)) {
      return res.status(404).json({ error: `Assignment ${a.id} not found in this roster` });
    }
  }

  await Promise.all(
    assignments.map((a) =>
      prisma.assignment.update({
        where: { id: a.id },
        data: { staffId: a.staffId, unfilledTag: a.unfilledTag },
      })
    )
  );

  const updated = await prisma.assignment.findMany({
    where: { rosterShiftId: { in: Array.from(rosterShiftIds) } },
    include: { staff: true },
  });

  res.json({ assignments: updated });
});
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd backend && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/rosters/assignmentRoutes.ts backend/src/rosters/__tests__/assignmentRoutes.test.ts
git commit -m "feat(backend): add bulk manual assignment save endpoint"
```

---

### Task 4: 前端 API client 扩展（Assignments）

**Files:**
- Modify: `frontend/src/api/client.ts`
- Test: `frontend/src/api/__tests__/client.test.ts`

**Interfaces:**
- Produces: 类型 `AssignmentEntry`；`RosterShift` 追加 `assignments: AssignmentEntry[]` 字段；`api.rosters.generateAssignments(id)`, `api.rosters.saveAssignments(id, assignments)`

- [ ] **Step 1: 写失败的测试（追加）**

```ts
// frontend/src/api/__tests__/client.test.ts — 追加
describe('api.rosters assignment methods', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('generates assignments', async () => {
    (fetch as any).mockResolvedValue({ ok: true, status: 200, json: async () => ({ assignments: [] }) });
    await api.rosters.generateAssignments('roster-1');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/rosters/roster-1/generate-assignments'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('saves assignments', async () => {
    (fetch as any).mockResolvedValue({ ok: true, status: 200, json: async () => ({ assignments: [] }) });
    await api.rosters.saveAssignments('roster-1', [{ id: 'a-1', staffId: null, unfilledTag: 'AGENT' }]);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/rosters/roster-1/assignments'),
      expect.objectContaining({ method: 'PUT' })
    );
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/api/__tests__/client.test.ts`
Expected: FAIL — `api.rosters.generateAssignments is undefined`

- [ ] **Step 3: 扩展 api/client.ts**

```ts
// frontend/src/api/client.ts — 追加类型
export interface AssignmentEntry {
  id: string;
  rosterShiftId: string;
  staffId: string | null;
  unfilledTag: string | null;
  staff: { id: string; name: string; email: string } | null;
}
```

修改已有的 `RosterShift` 接口（Plan 3 定义），在字段末尾追加 `assignments`：

```ts
export interface RosterShift {
  id: string;
  date: string;
  headcount: number;
  requiredSkills: string[];
  shiftTemplate: ShiftTemplate;
  assignments: AssignmentEntry[];
}
```

在 `api.rosters` 对象内追加：

```ts
    generateAssignments: (id: string) =>
      apiRequest<{ assignments: AssignmentEntry[] }>(`/rosters/${id}/generate-assignments`, { method: 'POST' }),
    saveAssignments: (id: string, assignments: { id: string; staffId: string | null; unfilledTag: string | null }[]) =>
      apiRequest<{ assignments: AssignmentEntry[] }>(`/rosters/${id}/assignments`, {
        method: 'PUT',
        body: JSON.stringify({ assignments }),
      }),
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd frontend && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/client.ts frontend/src/api/__tests__/client.test.ts
git commit -m "feat(frontend): extend api client with assignment generation and save"
```

---

### Task 5: Roster 详情页升级为复核编辑界面

**Files:**
- Modify: `frontend/src/pages/RosterDetailPage.tsx`
- Modify: `frontend/src/pages/__tests__/RosterDetailPage.test.tsx`

**Interfaces:**
- Consumes: `api.rosters.{get, generateAssignments, saveAssignments}`, `api.groups.listMembers`

- [ ] **Step 1: 用下面的内容整体替换测试文件**

```tsx
// frontend/src/pages/__tests__/RosterDetailPage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RosterDetailPage } from '../RosterDetailPage';
import { api } from '../../api/client';

vi.mock('../../api/client', () => ({
  api: {
    rosters: { get: vi.fn(), generateAssignments: vi.fn(), saveAssignments: vi.fn() },
    groups: { listMembers: vi.fn() },
  },
}));

const baseRoster = {
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
      headcount: 1,
      requiredSkills: [],
      shiftTemplate: { id: 'template-1', name: 'Morning', startTime: '06:00', endTime: '14:00' },
      assignments: [{ id: 'a-1', rosterShiftId: 'rs-1', staffId: null, unfilledTag: null, staff: null }],
    },
  ],
};

describe('RosterDetailPage', () => {
  beforeEach(() => vi.clearAllMocks());

  const renderPage = () =>
    render(
      <MemoryRouter initialEntries={['/rosters/roster-1']}>
        <Routes>
          <Route path="/rosters/:id" element={<RosterDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

  it('generates assignments via the AI and shows the result', async () => {
    (api.rosters.get as any).mockResolvedValue(baseRoster);
    (api.groups.listMembers as any).mockResolvedValue([{ id: 'staff-1', name: 'Alice', email: 'a@b.com', skills: [], preference: null }]);
    (api.rosters.generateAssignments as any).mockResolvedValue({
      assignments: [{ id: 'a-1', rosterShiftId: 'rs-1', staffId: 'staff-1', unfilledTag: null, staff: { id: 'staff-1', name: 'Alice', email: 'a@b.com' } }],
    });

    renderPage();

    await waitFor(() => expect(screen.getByText(/Morning/)).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: '生成排班' }));

    await waitFor(() => expect(api.rosters.generateAssignments).toHaveBeenCalledWith('roster-1'));
    await waitFor(() => expect(screen.getByDisplayValue('Alice')).toBeInTheDocument());
  });

  it('disables save until an edit is made, then saves the local changes', async () => {
    (api.rosters.get as any).mockResolvedValue(baseRoster);
    (api.groups.listMembers as any).mockResolvedValue([{ id: 'staff-1', name: 'Alice', email: 'a@b.com', skills: [], preference: null }]);
    (api.rosters.saveAssignments as any).mockResolvedValue({
      assignments: [{ id: 'a-1', rosterShiftId: 'rs-1', staffId: 'staff-1', unfilledTag: null, staff: { id: 'staff-1', name: 'Alice', email: 'a@b.com' } }],
    });

    renderPage();

    await waitFor(() => expect(screen.getByText(/Morning/)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: '保存' })).toBeDisabled();

    await userEvent.selectOptions(screen.getByLabelText('分配员工'), 'staff-1');
    expect(screen.getByRole('button', { name: '保存' })).toBeEnabled();

    await userEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() =>
      expect(api.rosters.saveAssignments).toHaveBeenCalledWith('roster-1', [
        { id: 'a-1', staffId: 'staff-1', unfilledTag: null },
      ])
    );
    expect(screen.getByRole('button', { name: '保存' })).toBeDisabled();
  });

  it('lets the user tag an unfilled slot', async () => {
    (api.rosters.get as any).mockResolvedValue(baseRoster);
    (api.groups.listMembers as any).mockResolvedValue([]);

    renderPage();

    await waitFor(() => expect(screen.getByText(/Morning/)).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'AGENT' }));

    expect(screen.getByRole('button', { name: '保存' })).toBeEnabled();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/pages/__tests__/RosterDetailPage.test.tsx`
Expected: FAIL — 当前 RosterDetailPage 是只读视图，没有"生成排班"/"保存"按钮

- [ ] **Step 3: 用下面的内容整体替换 RosterDetailPage.tsx**

```tsx
// frontend/src/pages/RosterDetailPage.tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, RosterDetail, AssignmentEntry, Staff } from '../api/client';

const TAG_OPTIONS = ['AGENT', 'PICKUP'];

export function RosterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [roster, setRoster] = useState<RosterDetail | null>(null);
  const [members, setMembers] = useState<Staff[]>([]);
  const [assignments, setAssignments] = useState<AssignmentEntry[]>([]);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const loadRoster = async () => {
    if (!id) return;
    const r = await api.rosters.get(id);
    setRoster(r);
    setAssignments(r.rosterShifts.flatMap((rs) => rs.assignments));
    const groupMembers = await api.groups.listMembers(r.groupId);
    setMembers(groupMembers);
    setDirty(false);
  };

  useEffect(() => {
    loadRoster();
  }, [id]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const handleGenerate = async () => {
    if (!id) return;
    setError(null);
    setGenerating(true);
    try {
      const result = await api.rosters.generateAssignments(id);
      setAssignments(result.assignments);
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 分配失败，请重试或手动排班');
    } finally {
      setGenerating(false);
    }
  };

  const updateAssignment = (assignmentId: string, patch: Partial<AssignmentEntry>) => {
    setAssignments((prev) => prev.map((a) => (a.id === assignmentId ? { ...a, ...patch } : a)));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!id) return;
    setError(null);
    try {
      const result = await api.rosters.saveAssignments(
        id,
        assignments.map((a) => ({ id: a.id, staffId: a.staffId, unfilledTag: a.unfilledTag }))
      );
      setAssignments(result.assignments);
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save assignments');
    }
  };

  if (!roster) return <div className="p-4">加载中...</div>;

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">{roster.name}</h1>
          <p className="text-sm text-gray-500">
            {roster.dateRangeStart.slice(0, 10)} ~ {roster.dateRangeEnd.slice(0, 10)} · 状态：{roster.status}
          </p>
        </div>
        <div className="flex gap-2">
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
        </div>
      </div>
      {error && (
        <p role="alert" className="text-red-600 text-sm">
          {error}
        </p>
      )}
      <ul className="divide-y">
        {roster.rosterShifts.map((rs) => {
          const rows = assignments.filter((a) => a.rosterShiftId === rs.id);
          return (
            <li key={rs.id} className="py-3 space-y-2">
              <p className="font-medium">
                {rs.date.slice(0, 10)} · {rs.shiftTemplate.name}（{rs.shiftTemplate.startTime}-{rs.shiftTemplate.endTime}）
              </p>
              <p className="text-sm text-gray-500">
                需要 {rs.headcount} 人{rs.requiredSkills.length > 0 ? ` · 技能: ${rs.requiredSkills.join(', ')}` : ''}
              </p>
              <div className="space-y-2">
                {rows.map((row) => (
                  <div key={row.id} className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <select
                      value={row.staffId ?? ''}
                      onChange={(e) => updateAssignment(row.id, { staffId: e.target.value || null, unfilledTag: null })}
                      aria-label="分配员工"
                      className="border rounded px-2 py-1 text-sm flex-1"
                    >
                      <option value="">未分配</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                    {!row.staffId && (
                      <div className="flex gap-1 items-center flex-wrap">
                        {TAG_OPTIONS.map((tag) => (
                          <button
                            type="button"
                            key={tag}
                            onClick={() => updateAssignment(row.id, { unfilledTag: tag })}
                            className={`border rounded px-2 py-1 text-xs ${
                              row.unfilledTag === tag ? 'bg-blue-600 text-white' : ''
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                        <input
                          placeholder="自定义标签"
                          value={row.unfilledTag && !TAG_OPTIONS.includes(row.unfilledTag) ? row.unfilledTag : ''}
                          onChange={(e) => updateAssignment(row.id, { unfilledTag: e.target.value || null })}
                          className="border rounded px-2 py-1 text-xs w-28"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd frontend && npm test`
Expected: PASS

- [ ] **Step 5: 手动验证（浏览器）**

打开一个已有 RosterShift 的排班详情页，点击"生成排班"（需要先在 `.env` 配好真实的 `AI_BASE_URL`/`AI_API_KEY`/`AI_MODEL`，否则会看到 502 报错提示，这也是预期行为）；用下拉框手动把某个坑位换成别的员工，确认"保存"按钮从禁用变为可用；点击保存后确认按钮恢复禁用；给一个未分配坑位点 AGENT 标签，确认按钮状态变化；不保存直接刷新页面，确认浏览器弹出离开确认提示。

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/RosterDetailPage.tsx frontend/src/pages/__tests__/RosterDetailPage.test.tsx
git commit -m "feat(frontend): upgrade roster detail page with ai assignment and manual review"
```

---

## Plan 4 完成检查

- [ ] 后端 `npm test` 全绿
- [ ] 前端 `npm test` 全绿
- [ ] 手动验证：AI 生成分配、手动换人、未分配打标签、显式保存机制、AI 失败提示全流程走通
- [ ] 所有 Task 已 commit
