# Roster Creator — Plan 2: 员工与小组管理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Plan 1 的认证基础上，实现员工（Staff + Preference）与自定义小组（StaffGroup + 成员管理）的完整 CRUD，前后端都要能用。

**Architecture:** 后端在 `requireAuth` 保护下新增 `/staff` 和 `/groups` 路由组，所有查询都按 `userId` 隔离数据；前端新增员工列表/编辑页、小组列表/成员管理页，复用 Plan 1 的 `api/client.ts` 和路由结构。

**Tech Stack:** 与 Plan 1 相同（Express, TypeScript, Prisma, Vite, React, Tailwind, Vitest, Supertest, React Testing Library）

**Spec:** [docs/superpowers/specs/2026-08-18-roster-creator-design.md](../specs/2026-08-18-roster-creator-design.md)

**依赖：** 本计划假定 Plan 1（`docs/superpowers/plans/2026-08-18-plan1-scaffolding-auth.md`）已执行完成——`createApp()`、`prisma` 单例、`requireAuth` 中间件、`AuthedRequest` 类型、前端 `api/client.ts`、`AuthProvider`/`ProtectedRoute`、`App.tsx` 路由骨架均已存在。

## Global Constraints

- 所有 Staff / StaffGroup 资源必须按 `userId` 隔离，跨用户访问一律返回 404（不用 403，避免暴露资源存在与否）（spec 1, 3）
- `Preference.minHoursPerWeek` 不能大于 `maxHoursPerWeek`（spec 5.1 隐含约束）
- 移动端响应式：列表在小屏幕下用纵向堆叠布局，按钮保持可点击尺寸（spec 7）
- 测试中鉴权统一用 `signToken({ userId })` 生成 cookie 直接 `.set('Cookie', ...)`，不必每次都走登录流程

---

## 文件结构总览

```
backend/src/
  staff/
    routes.ts              — Staff CRUD (list/get/create/update/delete)
    preferenceRoutes.ts    — PUT /staff/:id/preference
    __tests__/routes.test.ts, preferenceRoutes.test.ts
  groups/
    routes.ts               — StaffGroup CRUD
    membershipRoutes.ts     — GET/POST/DELETE /groups/:id/members
    __tests__/routes.test.ts, membershipRoutes.test.ts

frontend/src/
  api/client.ts              — modify: add staff.*, groups.* methods + types
  pages/
    StaffListPage.tsx, StaffEditPage.tsx
    GroupListPage.tsx, GroupDetailPage.tsx
    __tests__/StaffListPage.test.tsx, StaffEditPage.test.tsx,
              GroupListPage.test.tsx, GroupDetailPage.test.tsx
  App.tsx                    — modify: add protected routes
  pages/DashboardPage.tsx    — modify: add nav links
```

---

### Task 1: Staff CRUD API

**Files:**
- Create: `backend/src/staff/routes.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/src/staff/__tests__/routes.test.ts`

**Interfaces:**
- Consumes: `prisma` from `../db`, `requireAuth`/`AuthedRequest` from `../auth/middleware`, `signToken` from `../auth/jwt` (test only)
- Produces: `staffRouter` (mounted at `/staff`): `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id`. 响应体形状：`{ id, userId, name, email, skills: string[], preference: Preference | null }`

- [ ] **Step 1: 写失败的测试**

```ts
// backend/src/staff/__tests__/routes.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../db', () => ({
  prisma: {
    staff: {
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

describe('GET /staff', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/staff');
    expect(res.status).toBe(401);
  });

  it('returns staff scoped to the current user', async () => {
    (prisma.staff.findMany as any).mockResolvedValue([
      { id: 'staff-1', userId: 'user-1', name: 'Alice', email: 'alice@b.com', skills: [], preference: null },
    ]);

    const res = await request(app).get('/staff').set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(prisma.staff.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } })
    );
    expect(res.body).toHaveLength(1);
  });
});

describe('GET /staff/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 404 for another user\'s staff', async () => {
    (prisma.staff.findUnique as any).mockResolvedValue({ id: 'staff-1', userId: 'someone-else' });

    const res = await request(app).get('/staff/staff-1').set('Cookie', authCookie);

    expect(res.status).toBe(404);
  });

  it('returns the staff member with preference', async () => {
    (prisma.staff.findUnique as any).mockResolvedValue({
      id: 'staff-1',
      userId: 'user-1',
      name: 'Alice',
      email: 'alice@b.com',
      skills: [],
      preference: null,
    });

    const res = await request(app).get('/staff/staff-1').set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Alice');
  });
});

describe('POST /staff', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a staff member for the current user', async () => {
    (prisma.staff.create as any).mockResolvedValue({
      id: 'staff-1',
      userId: 'user-1',
      name: 'Alice',
      email: 'alice@b.com',
      skills: ['cashier'],
    });

    const res = await request(app)
      .post('/staff')
      .set('Cookie', authCookie)
      .send({ name: 'Alice', email: 'alice@b.com', skills: ['cashier'] });

    expect(res.status).toBe(201);
    expect(prisma.staff.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', name: 'Alice', email: 'alice@b.com', skills: ['cashier'] },
    });
  });

  it('rejects missing name', async () => {
    const res = await request(app).post('/staff').set('Cookie', authCookie).send({ email: 'a@b.com' });
    expect(res.status).toBe(400);
  });
});

describe('PUT /staff/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates a staff member owned by the current user', async () => {
    (prisma.staff.findUnique as any).mockResolvedValue({ id: 'staff-1', userId: 'user-1' });
    (prisma.staff.update as any).mockResolvedValue({
      id: 'staff-1',
      userId: 'user-1',
      name: 'Alice B',
      email: 'alice@b.com',
      skills: [],
    });

    const res = await request(app)
      .put('/staff/staff-1')
      .set('Cookie', authCookie)
      .send({ name: 'Alice B', email: 'alice@b.com', skills: [] });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Alice B');
  });

  it('returns 404 when the staff member belongs to another user', async () => {
    (prisma.staff.findUnique as any).mockResolvedValue({ id: 'staff-1', userId: 'someone-else' });

    const res = await request(app).put('/staff/staff-1').set('Cookie', authCookie).send({ name: 'Hack' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /staff/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes a staff member owned by the current user', async () => {
    (prisma.staff.findUnique as any).mockResolvedValue({ id: 'staff-1', userId: 'user-1' });
    (prisma.staff.delete as any).mockResolvedValue({ id: 'staff-1' });

    const res = await request(app).delete('/staff/staff-1').set('Cookie', authCookie);

    expect(res.status).toBe(204);
  });

  it('returns 404 when the staff member belongs to another user', async () => {
    (prisma.staff.findUnique as any).mockResolvedValue({ id: 'staff-1', userId: 'someone-else' });

    const res = await request(app).delete('/staff/staff-1').set('Cookie', authCookie);

    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && npx vitest run src/staff/__tests__/routes.test.ts`
Expected: FAIL — `Cannot find module '../routes'`（或 404，因为路由未挂载）

- [ ] **Step 3: 实现 staff/routes.ts**

```ts
// backend/src/staff/routes.ts
import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../auth/middleware';

export const staffRouter = Router();
staffRouter.use(requireAuth);

staffRouter.get('/', async (req: AuthedRequest, res) => {
  const staff = await prisma.staff.findMany({
    where: { userId: req.userId },
    include: { preference: true },
    orderBy: { name: 'asc' },
  });
  res.json(staff);
});

staffRouter.get('/:id', async (req: AuthedRequest, res) => {
  const staff = await prisma.staff.findUnique({
    where: { id: req.params.id },
    include: { preference: true },
  });
  if (!staff || staff.userId !== req.userId) {
    return res.status(404).json({ error: 'Staff not found' });
  }
  res.json(staff);
});

staffRouter.post('/', async (req: AuthedRequest, res) => {
  const { name, email, skills } = req.body as { name?: string; email?: string; skills?: string[] };
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }
  const staff = await prisma.staff.create({
    data: { userId: req.userId!, name, email, skills: skills ?? [] },
  });
  res.status(201).json(staff);
});

staffRouter.put('/:id', async (req: AuthedRequest, res) => {
  const existing = await prisma.staff.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.userId !== req.userId) {
    return res.status(404).json({ error: 'Staff not found' });
  }
  const { name, email, skills } = req.body as { name?: string; email?: string; skills?: string[] };
  const staff = await prisma.staff.update({
    where: { id: req.params.id },
    data: { name, email, skills },
  });
  res.json(staff);
});

staffRouter.delete('/:id', async (req: AuthedRequest, res) => {
  const existing = await prisma.staff.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.userId !== req.userId) {
    return res.status(404).json({ error: 'Staff not found' });
  }
  await prisma.staff.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
```

- [ ] **Step 4: 挂载到 app.ts**

```ts
// backend/src/app.ts — 顶部加 import { staffRouter } from './staff/routes';
// 在其他 app.use 之后加：
  app.use('/staff', staffRouter);
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd backend && npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/staff/routes.ts backend/src/app.ts backend/src/staff/__tests__/routes.test.ts
git commit -m "feat(backend): add staff crud endpoints"
```

---

### Task 2: Staff Preference API

**Files:**
- Create: `backend/src/staff/preferenceRoutes.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/src/staff/__tests__/preferenceRoutes.test.ts`

**Interfaces:**
- Consumes: `prisma`, `requireAuth`/`AuthedRequest`
- Produces: `preferenceRouter` (mounted at `/staff`): `PUT /:id/preference`，body `{ preferredShiftTemplateIds, unavailableDateRanges, minHoursPerWeek, maxHoursPerWeek, preferredWeekdays }`

- [ ] **Step 1: 写失败的测试**

```ts
// backend/src/staff/__tests__/preferenceRoutes.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../db', () => ({
  prisma: {
    staff: { findUnique: vi.fn() },
    preference: { upsert: vi.fn() },
  },
}));

import { prisma } from '../../db';
import { createApp } from '../../app';
import { signToken } from '../../auth/jwt';

const app = createApp();
const authCookie = `token=${signToken({ userId: 'user-1' })}`;

describe('PUT /staff/:id/preference', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 404 for another user\'s staff', async () => {
    (prisma.staff.findUnique as any).mockResolvedValue({ id: 'staff-1', userId: 'someone-else' });

    const res = await request(app)
      .put('/staff/staff-1/preference')
      .set('Cookie', authCookie)
      .send({ minHoursPerWeek: 10, maxHoursPerWeek: 30 });

    expect(res.status).toBe(404);
  });

  it('rejects minHoursPerWeek greater than maxHoursPerWeek', async () => {
    (prisma.staff.findUnique as any).mockResolvedValue({ id: 'staff-1', userId: 'user-1' });

    const res = await request(app)
      .put('/staff/staff-1/preference')
      .set('Cookie', authCookie)
      .send({ minHoursPerWeek: 40, maxHoursPerWeek: 20 });

    expect(res.status).toBe(400);
  });

  it('upserts the preference', async () => {
    (prisma.staff.findUnique as any).mockResolvedValue({ id: 'staff-1', userId: 'user-1' });
    (prisma.preference.upsert as any).mockResolvedValue({
      id: 'pref-1',
      staffId: 'staff-1',
      preferredShiftTemplateIds: [],
      unavailableDateRanges: [],
      minHoursPerWeek: 10,
      maxHoursPerWeek: 30,
      preferredWeekdays: [1, 2, 3],
    });

    const res = await request(app)
      .put('/staff/staff-1/preference')
      .set('Cookie', authCookie)
      .send({ minHoursPerWeek: 10, maxHoursPerWeek: 30, preferredWeekdays: [1, 2, 3] });

    expect(res.status).toBe(200);
    expect(res.body.preferredWeekdays).toEqual([1, 2, 3]);
    expect(prisma.preference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { staffId: 'staff-1' } })
    );
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && npx vitest run src/staff/__tests__/preferenceRoutes.test.ts`
Expected: FAIL — `Cannot find module '../preferenceRoutes'`

- [ ] **Step 3: 实现 preferenceRoutes.ts**

```ts
// backend/src/staff/preferenceRoutes.ts
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
```

- [ ] **Step 4: 挂载到 app.ts**

```ts
// backend/src/app.ts — 顶部加 import { preferenceRouter } from './staff/preferenceRoutes';
// 在 app.use('/staff', staffRouter) 之后加：
  app.use('/staff', preferenceRouter);
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd backend && npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/staff/preferenceRoutes.ts backend/src/app.ts backend/src/staff/__tests__/preferenceRoutes.test.ts
git commit -m "feat(backend): add staff preference upsert endpoint"
```

---

### Task 3: StaffGroup CRUD API

**Files:**
- Create: `backend/src/groups/routes.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/src/groups/__tests__/routes.test.ts`

**Interfaces:**
- Produces: `groupsRouter` (mounted at `/groups`): `GET /`, `POST /`, `PUT /:id`, `DELETE /:id`. 响应体形状：`{ id, name, memberCount }`

- [ ] **Step 1: 写失败的测试**

```ts
// backend/src/groups/__tests__/routes.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../db', () => ({
  prisma: {
    staffGroup: {
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

describe('GET /groups', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns groups with member counts', async () => {
    (prisma.staffGroup.findMany as any).mockResolvedValue([
      { id: 'group-1', name: 'Kitchen', _count: { members: 3 } },
    ]);

    const res = await request(app).get('/groups').set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 'group-1', name: 'Kitchen', memberCount: 3 }]);
  });
});

describe('POST /groups', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a group', async () => {
    (prisma.staffGroup.create as any).mockResolvedValue({ id: 'group-1', userId: 'user-1', name: 'Kitchen' });

    const res = await request(app).post('/groups').set('Cookie', authCookie).send({ name: 'Kitchen' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: 'group-1', name: 'Kitchen', memberCount: 0 });
  });

  it('rejects missing name', async () => {
    const res = await request(app).post('/groups').set('Cookie', authCookie).send({});
    expect(res.status).toBe(400);
  });
});

describe('PUT /groups/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renames a group owned by the current user', async () => {
    (prisma.staffGroup.findUnique as any).mockResolvedValue({ id: 'group-1', userId: 'user-1' });
    (prisma.staffGroup.update as any).mockResolvedValue({ id: 'group-1', name: 'Front of House' });

    const res = await request(app).put('/groups/group-1').set('Cookie', authCookie).send({ name: 'Front of House' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Front of House');
  });

  it('returns 404 for another user\'s group', async () => {
    (prisma.staffGroup.findUnique as any).mockResolvedValue({ id: 'group-1', userId: 'someone-else' });

    const res = await request(app).put('/groups/group-1').set('Cookie', authCookie).send({ name: 'Hack' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /groups/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes a group owned by the current user', async () => {
    (prisma.staffGroup.findUnique as any).mockResolvedValue({ id: 'group-1', userId: 'user-1' });
    (prisma.staffGroup.delete as any).mockResolvedValue({ id: 'group-1' });

    const res = await request(app).delete('/groups/group-1').set('Cookie', authCookie);

    expect(res.status).toBe(204);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && npx vitest run src/groups/__tests__/routes.test.ts`
Expected: FAIL — `Cannot find module '../routes'`

- [ ] **Step 3: 实现 groups/routes.ts**

```ts
// backend/src/groups/routes.ts
import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../auth/middleware';

export const groupsRouter = Router();
groupsRouter.use(requireAuth);

groupsRouter.get('/', async (req: AuthedRequest, res) => {
  const groups = await prisma.staffGroup.findMany({
    where: { userId: req.userId },
    include: { _count: { select: { members: true } } },
    orderBy: { name: 'asc' },
  });
  res.json(groups.map((g) => ({ id: g.id, name: g.name, memberCount: g._count.members })));
});

groupsRouter.post('/', async (req: AuthedRequest, res) => {
  const { name } = req.body as { name?: string };
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const group = await prisma.staffGroup.create({ data: { userId: req.userId!, name } });
  res.status(201).json({ id: group.id, name: group.name, memberCount: 0 });
});

groupsRouter.put('/:id', async (req: AuthedRequest, res) => {
  const existing = await prisma.staffGroup.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.userId !== req.userId) {
    return res.status(404).json({ error: 'Group not found' });
  }
  const { name } = req.body as { name?: string };
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const group = await prisma.staffGroup.update({ where: { id: req.params.id }, data: { name } });
  res.json({ id: group.id, name: group.name });
});

groupsRouter.delete('/:id', async (req: AuthedRequest, res) => {
  const existing = await prisma.staffGroup.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.userId !== req.userId) {
    return res.status(404).json({ error: 'Group not found' });
  }
  await prisma.staffGroup.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
```

- [ ] **Step 4: 挂载到 app.ts**

```ts
// backend/src/app.ts — 顶部加 import { groupsRouter } from './groups/routes';
// 加一行：
  app.use('/groups', groupsRouter);
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd backend && npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/groups/routes.ts backend/src/app.ts backend/src/groups/__tests__/routes.test.ts
git commit -m "feat(backend): add staff group crud endpoints"
```

---

### Task 4: 小组成员管理 API

**Files:**
- Create: `backend/src/groups/membershipRoutes.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/src/groups/__tests__/membershipRoutes.test.ts`

**Interfaces:**
- Produces: `groupMembershipRouter` (mounted at `/groups`): `GET /:id/members` (返回 `Staff[]`), `POST /:id/members` (body `{ staffId }`), `DELETE /:id/members/:staffId`

- [ ] **Step 1: 写失败的测试**

```ts
// backend/src/groups/__tests__/membershipRoutes.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../db', () => ({
  prisma: {
    staffGroup: { findUnique: vi.fn() },
    staff: { findUnique: vi.fn() },
    groupMember: { findMany: vi.fn(), create: vi.fn(), delete: vi.fn() },
  },
}));

import { prisma } from '../../db';
import { createApp } from '../../app';
import { signToken } from '../../auth/jwt';

const app = createApp();
const authCookie = `token=${signToken({ userId: 'user-1' })}`;

describe('GET /groups/:id/members', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 404 for another user\'s group', async () => {
    (prisma.staffGroup.findUnique as any).mockResolvedValue({ id: 'group-1', userId: 'someone-else' });

    const res = await request(app).get('/groups/group-1/members').set('Cookie', authCookie);

    expect(res.status).toBe(404);
  });

  it('lists the staff in the group', async () => {
    (prisma.staffGroup.findUnique as any).mockResolvedValue({ id: 'group-1', userId: 'user-1' });
    (prisma.groupMember.findMany as any).mockResolvedValue([
      { groupId: 'group-1', staffId: 'staff-1', staff: { id: 'staff-1', name: 'Alice' } },
    ]);

    const res = await request(app).get('/groups/group-1/members').set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 'staff-1', name: 'Alice' }]);
  });
});

describe('POST /groups/:id/members', () => {
  beforeEach(() => vi.clearAllMocks());

  it('adds a staff member owned by the current user', async () => {
    (prisma.staffGroup.findUnique as any).mockResolvedValue({ id: 'group-1', userId: 'user-1' });
    (prisma.staff.findUnique as any).mockResolvedValue({ id: 'staff-1', userId: 'user-1' });
    (prisma.groupMember.create as any).mockResolvedValue({ groupId: 'group-1', staffId: 'staff-1' });

    const res = await request(app)
      .post('/groups/group-1/members')
      .set('Cookie', authCookie)
      .send({ staffId: 'staff-1' });

    expect(res.status).toBe(201);
    expect(prisma.groupMember.create).toHaveBeenCalledWith({ data: { groupId: 'group-1', staffId: 'staff-1' } });
  });

  it('rejects a staff member owned by another user', async () => {
    (prisma.staffGroup.findUnique as any).mockResolvedValue({ id: 'group-1', userId: 'user-1' });
    (prisma.staff.findUnique as any).mockResolvedValue({ id: 'staff-1', userId: 'someone-else' });

    const res = await request(app)
      .post('/groups/group-1/members')
      .set('Cookie', authCookie)
      .send({ staffId: 'staff-1' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /groups/:id/members/:staffId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('removes a member from the group', async () => {
    (prisma.staffGroup.findUnique as any).mockResolvedValue({ id: 'group-1', userId: 'user-1' });
    (prisma.groupMember.delete as any).mockResolvedValue({ groupId: 'group-1', staffId: 'staff-1' });

    const res = await request(app).delete('/groups/group-1/members/staff-1').set('Cookie', authCookie);

    expect(res.status).toBe(204);
    expect(prisma.groupMember.delete).toHaveBeenCalledWith({
      where: { groupId_staffId: { groupId: 'group-1', staffId: 'staff-1' } },
    });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && npx vitest run src/groups/__tests__/membershipRoutes.test.ts`
Expected: FAIL — `Cannot find module '../membershipRoutes'`

- [ ] **Step 3: 实现 membershipRoutes.ts**

```ts
// backend/src/groups/membershipRoutes.ts
import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../auth/middleware';

export const groupMembershipRouter = Router();
groupMembershipRouter.use(requireAuth);

async function ensureOwnedGroup(groupId: string, userId: string) {
  const group = await prisma.staffGroup.findUnique({ where: { id: groupId } });
  if (!group || group.userId !== userId) return null;
  return group;
}

groupMembershipRouter.get('/:id/members', async (req: AuthedRequest, res) => {
  const group = await ensureOwnedGroup(req.params.id, req.userId!);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const members = await prisma.groupMember.findMany({
    where: { groupId: req.params.id },
    include: { staff: true },
  });
  res.json(members.map((m) => m.staff));
});

groupMembershipRouter.post('/:id/members', async (req: AuthedRequest, res) => {
  const group = await ensureOwnedGroup(req.params.id, req.userId!);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const { staffId } = req.body as { staffId?: string };
  if (!staffId) return res.status(400).json({ error: 'staffId is required' });

  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff || staff.userId !== req.userId) {
    return res.status(404).json({ error: 'Staff not found' });
  }

  await prisma.groupMember.create({ data: { groupId: req.params.id, staffId } });
  res.status(201).send();
});

groupMembershipRouter.delete('/:id/members/:staffId', async (req: AuthedRequest, res) => {
  const group = await ensureOwnedGroup(req.params.id, req.userId!);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  await prisma.groupMember.delete({
    where: { groupId_staffId: { groupId: req.params.id, staffId: req.params.staffId } },
  });
  res.status(204).send();
});
```

- [ ] **Step 4: 挂载到 app.ts**

```ts
// backend/src/app.ts — 顶部加 import { groupMembershipRouter } from './groups/membershipRoutes';
// 在 app.use('/groups', groupsRouter) 之后加：
  app.use('/groups', groupMembershipRouter);
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd backend && npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/groups/membershipRoutes.ts backend/src/app.ts backend/src/groups/__tests__/membershipRoutes.test.ts
git commit -m "feat(backend): add group membership endpoints"
```

---

### Task 5: 前端 API client 扩展（Staff + Groups）

**Files:**
- Modify: `frontend/src/api/client.ts`
- Test: `frontend/src/api/__tests__/client.test.ts`

**Interfaces:**
- Produces: 类型 `Preference`, `Staff`, `StaffGroup`；`api.staff.{list, get, create, update, remove, updatePreference}`；`api.groups.{list, create, rename, remove, listMembers, addMember, removeMember}`

- [ ] **Step 1: 写失败的测试（追加到已有文件）**

```ts
// frontend/src/api/__tests__/client.test.ts — 追加以下 describe 块
describe('api.staff', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('lists staff', async () => {
    (fetch as any).mockResolvedValue({ ok: true, status: 200, json: async () => [] });
    await api.staff.list();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/staff'), expect.objectContaining({ credentials: 'include' }));
  });

  it('creates staff', async () => {
    (fetch as any).mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: 'staff-1' }) });
    await api.staff.create({ name: 'Alice', email: 'a@b.com', skills: [] });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/staff'),
      expect.objectContaining({ method: 'POST' })
    );
  });
});

describe('api.groups', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('adds a member', async () => {
    (fetch as any).mockResolvedValue({ ok: true, status: 201, json: async () => ({}) });
    await api.groups.addMember('group-1', 'staff-1');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/groups/group-1/members'),
      expect.objectContaining({ method: 'POST' })
    );
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/api/__tests__/client.test.ts`
Expected: FAIL — `api.staff is undefined`

- [ ] **Step 3: 扩展 api/client.ts**

```ts
// frontend/src/api/client.ts — 在已有 User 接口之后追加类型，在 export const api 对象中追加 staff/groups
export interface Preference {
  id: string;
  staffId: string;
  preferredShiftTemplateIds: string[];
  unavailableDateRanges: { start: string; end: string }[];
  minHoursPerWeek: number;
  maxHoursPerWeek: number;
  preferredWeekdays: number[];
}

export interface Staff {
  id: string;
  name: string;
  email: string;
  skills: string[];
  preference: Preference | null;
}

export interface StaffGroup {
  id: string;
  name: string;
  memberCount: number;
}

export interface PreferenceInput {
  preferredShiftTemplateIds: string[];
  unavailableDateRanges: { start: string; end: string }[];
  minHoursPerWeek: number;
  maxHoursPerWeek: number;
  preferredWeekdays: number[];
}
```

在 `export const api = { ... }` 对象字面量内追加：

```ts
  staff: {
    list: () => apiRequest<Staff[]>('/staff'),
    get: (id: string) => apiRequest<Staff>(`/staff/${id}`),
    create: (data: { name: string; email: string; skills: string[] }) =>
      apiRequest<Staff>('/staff', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { name: string; email: string; skills: string[] }) =>
      apiRequest<Staff>(`/staff/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: string) => apiRequest<void>(`/staff/${id}`, { method: 'DELETE' }),
    updatePreference: (id: string, data: PreferenceInput) =>
      apiRequest<Preference>(`/staff/${id}/preference`, { method: 'PUT', body: JSON.stringify(data) }),
  },
  groups: {
    list: () => apiRequest<StaffGroup[]>('/groups'),
    create: (name: string) => apiRequest<StaffGroup>('/groups', { method: 'POST', body: JSON.stringify({ name }) }),
    rename: (id: string, name: string) =>
      apiRequest<StaffGroup>(`/groups/${id}`, { method: 'PUT', body: JSON.stringify({ name }) }),
    remove: (id: string) => apiRequest<void>(`/groups/${id}`, { method: 'DELETE' }),
    listMembers: (id: string) => apiRequest<Staff[]>(`/groups/${id}/members`),
    addMember: (id: string, staffId: string) =>
      apiRequest<void>(`/groups/${id}/members`, { method: 'POST', body: JSON.stringify({ staffId }) }),
    removeMember: (id: string, staffId: string) =>
      apiRequest<void>(`/groups/${id}/members/${staffId}`, { method: 'DELETE' }),
  },
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd frontend && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/client.ts frontend/src/api/__tests__/client.test.ts
git commit -m "feat(frontend): extend api client with staff and group methods"
```

---

### Task 6: 员工列表页

**Files:**
- Create: `frontend/src/pages/StaffListPage.tsx`
- Test: `frontend/src/pages/__tests__/StaffListPage.test.tsx`

**Interfaces:**
- Consumes: `api.staff.{list, create, remove}` from `../api/client`

- [ ] **Step 1: 写失败的测试**

```tsx
// frontend/src/pages/__tests__/StaffListPage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { StaffListPage } from '../StaffListPage';
import { api } from '../../api/client';

vi.mock('../../api/client', () => ({
  api: { staff: { list: vi.fn(), create: vi.fn(), remove: vi.fn() } },
}));

describe('StaffListPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists existing staff', async () => {
    (api.staff.list as any).mockResolvedValue([
      { id: 'staff-1', name: 'Alice', email: 'alice@b.com', skills: [], preference: null },
    ]);

    render(
      <MemoryRouter>
        <StaffListPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
  });

  it('creates a staff member from the form', async () => {
    (api.staff.list as any).mockResolvedValue([]);
    (api.staff.create as any).mockResolvedValue({ id: 'staff-1', name: 'Bob', email: 'bob@b.com', skills: [] });

    render(
      <MemoryRouter>
        <StaffListPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(api.staff.list).toHaveBeenCalled());
    await userEvent.type(screen.getByPlaceholderText('姓名'), 'Bob');
    await userEvent.type(screen.getByPlaceholderText('邮箱'), 'bob@b.com');
    await userEvent.click(screen.getByRole('button', { name: '添加员工' }));

    await waitFor(() =>
      expect(api.staff.create).toHaveBeenCalledWith({ name: 'Bob', email: 'bob@b.com', skills: [] })
    );
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/pages/__tests__/StaffListPage.test.tsx`
Expected: FAIL — `Cannot find module '../StaffListPage'`

- [ ] **Step 3: 实现 StaffListPage.tsx**

```tsx
// frontend/src/pages/StaffListPage.tsx
import { useEffect, useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, Staff } from '../api/client';

export function StaffListPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = async () => setStaff(await api.staff.list());

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.staff.create({ name, email, skills: [] });
      setName('');
      setEmail('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create staff');
    }
  };

  const handleDelete = async (id: string) => {
    await api.staff.remove(id);
    await load();
  };

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-xl font-semibold">员工管理</h1>
      {error && (
        <p role="alert" className="text-red-600 text-sm">
          {error}
        </p>
      )}
      <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-2">
        <input
          placeholder="姓名"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border rounded px-3 py-2 flex-1"
          required
        />
        <input
          type="email"
          placeholder="邮箱"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border rounded px-3 py-2 flex-1"
          required
        />
        <button type="submit" className="bg-blue-600 text-white rounded px-4 py-2">
          添加员工
        </button>
      </form>
      <ul className="divide-y">
        {staff.map((s) => (
          <li key={s.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <p className="font-medium">{s.name}</p>
              <p className="text-sm text-gray-500">{s.email}</p>
            </div>
            <div className="flex gap-2">
              <Link to={`/staff/${s.id}`} className="border rounded px-3 py-1 text-sm">
                编辑
              </Link>
              <button onClick={() => handleDelete(s.id)} className="border rounded px-3 py-1 text-sm text-red-600">
                删除
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd frontend && npx vitest run src/pages/__tests__/StaffListPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/StaffListPage.tsx frontend/src/pages/__tests__/StaffListPage.test.tsx
git commit -m "feat(frontend): add staff list page"
```

---

### Task 7: 员工编辑页（含 Preference 表单）

**Files:**
- Create: `frontend/src/pages/StaffEditPage.tsx`
- Test: `frontend/src/pages/__tests__/StaffEditPage.test.tsx`

**Interfaces:**
- Consumes: `api.staff.{get, update, updatePreference}` from `../api/client`

- [ ] **Step 1: 写失败的测试**

```tsx
// frontend/src/pages/__tests__/StaffEditPage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { StaffEditPage } from '../StaffEditPage';
import { api } from '../../api/client';

vi.mock('../../api/client', () => ({
  api: { staff: { get: vi.fn(), update: vi.fn(), updatePreference: vi.fn() } },
}));

describe('StaffEditPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads staff data and saves updated fields', async () => {
    (api.staff.get as any).mockResolvedValue({
      id: 'staff-1',
      name: 'Alice',
      email: 'alice@b.com',
      skills: ['cashier'],
      preference: {
        id: 'pref-1',
        staffId: 'staff-1',
        preferredShiftTemplateIds: [],
        unavailableDateRanges: [],
        minHoursPerWeek: 10,
        maxHoursPerWeek: 30,
        preferredWeekdays: [1],
      },
    });
    (api.staff.update as any).mockResolvedValue({});
    (api.staff.updatePreference as any).mockResolvedValue({});

    render(
      <MemoryRouter initialEntries={['/staff/staff-1']}>
        <Routes>
          <Route path="/staff/:id" element={<StaffEditPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByDisplayValue('Alice')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() =>
      expect(api.staff.update).toHaveBeenCalledWith('staff-1', {
        name: 'Alice',
        email: 'alice@b.com',
        skills: ['cashier'],
      })
    );
    expect(api.staff.updatePreference).toHaveBeenCalledWith(
      'staff-1',
      expect.objectContaining({ minHoursPerWeek: 10, maxHoursPerWeek: 30, preferredWeekdays: [1] })
    );
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/pages/__tests__/StaffEditPage.test.tsx`
Expected: FAIL — `Cannot find module '../StaffEditPage'`

- [ ] **Step 3: 实现 StaffEditPage.tsx**

```tsx
// frontend/src/pages/StaffEditPage.tsx
import { useEffect, useState, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, Staff } from '../api/client';

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function StaffEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [staff, setStaff] = useState<Staff | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [skills, setSkills] = useState('');
  const [minHours, setMinHours] = useState(0);
  const [maxHours, setMaxHours] = useState(40);
  const [preferredWeekdays, setPreferredWeekdays] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.staff.get(id).then((s) => {
      setStaff(s);
      setName(s.name);
      setEmail(s.email);
      setSkills(s.skills.join(', '));
      if (s.preference) {
        setMinHours(s.preference.minHoursPerWeek);
        setMaxHours(s.preference.maxHoursPerWeek);
        setPreferredWeekdays(s.preference.preferredWeekdays);
      }
    });
  }, [id]);

  const toggleWeekday = (day: number) => {
    setPreferredWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setError(null);
    const skillList = skills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      await api.staff.update(id, { name, email, skills: skillList });
      await api.staff.updatePreference(id, {
        preferredShiftTemplateIds: staff?.preference?.preferredShiftTemplateIds ?? [],
        unavailableDateRanges: staff?.preference?.unavailableDateRanges ?? [],
        minHoursPerWeek: minHours,
        maxHoursPerWeek: maxHours,
        preferredWeekdays,
      });
      navigate('/staff');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save staff');
    }
  };

  if (!staff) return <div className="p-4">加载中...</div>;

  return (
    <div className="p-4 max-w-lg space-y-4">
      <h1 className="text-xl font-semibold">编辑员工</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p role="alert" className="text-red-600 text-sm">
            {error}
          </p>
        )}
        <input
          placeholder="姓名"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border rounded px-3 py-2"
          required
        />
        <input
          type="email"
          placeholder="邮箱"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded px-3 py-2"
          required
        />
        <input
          placeholder="技能（逗号分隔）"
          value={skills}
          onChange={(e) => setSkills(e.target.value)}
          className="w-full border rounded px-3 py-2"
        />
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm">
            最小周工时
            <input
              type="number"
              value={minHours}
              onChange={(e) => setMinHours(Number(e.target.value))}
              className="w-full border rounded px-3 py-2"
            />
          </label>
          <label className="text-sm">
            最大周工时
            <input
              type="number"
              value={maxHours}
              onChange={(e) => setMaxHours(Number(e.target.value))}
              className="w-full border rounded px-3 py-2"
            />
          </label>
        </div>
        <div>
          <p className="text-sm mb-1">偏好上班的星期几</p>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((label, day) => (
              <button
                type="button"
                key={day}
                onClick={() => toggleWeekday(day)}
                className={`border rounded px-3 py-1 text-sm ${
                  preferredWeekdays.includes(day) ? 'bg-blue-600 text-white' : ''
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <button type="submit" className="bg-blue-600 text-white rounded px-4 py-2">
          保存
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd frontend && npx vitest run src/pages/__tests__/StaffEditPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/StaffEditPage.tsx frontend/src/pages/__tests__/StaffEditPage.test.tsx
git commit -m "feat(frontend): add staff edit page with preference form"
```

---

### Task 8: 小组列表页 + 成员管理页 + 路由整合

**Files:**
- Create: `frontend/src/pages/GroupListPage.tsx`
- Create: `frontend/src/pages/GroupDetailPage.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Test: `frontend/src/pages/__tests__/GroupListPage.test.tsx`
- Test: `frontend/src/pages/__tests__/GroupDetailPage.test.tsx`

**Interfaces:**
- Consumes: `api.groups.*`, `api.staff.list` from `../api/client`

- [ ] **Step 1: 写失败的 GroupListPage 测试**

```tsx
// frontend/src/pages/__tests__/GroupListPage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { GroupListPage } from '../GroupListPage';
import { api } from '../../api/client';

vi.mock('../../api/client', () => ({
  api: { groups: { list: vi.fn(), create: vi.fn(), rename: vi.fn(), remove: vi.fn() } },
}));

describe('GroupListPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists existing groups with member counts', async () => {
    (api.groups.list as any).mockResolvedValue([{ id: 'group-1', name: 'Kitchen', memberCount: 2 }]);

    render(
      <MemoryRouter>
        <GroupListPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Kitchen')).toBeInTheDocument());
    expect(screen.getByText('2 名成员')).toBeInTheDocument();
  });

  it('creates a group from the form', async () => {
    (api.groups.list as any).mockResolvedValue([]);
    (api.groups.create as any).mockResolvedValue({ id: 'group-1', name: 'Front', memberCount: 0 });

    render(
      <MemoryRouter>
        <GroupListPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(api.groups.list).toHaveBeenCalled());
    await userEvent.type(screen.getByPlaceholderText('小组名称'), 'Front');
    await userEvent.click(screen.getByRole('button', { name: '创建小组' }));

    await waitFor(() => expect(api.groups.create).toHaveBeenCalledWith('Front'));
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/pages/__tests__/GroupListPage.test.tsx`
Expected: FAIL — `Cannot find module '../GroupListPage'`

- [ ] **Step 3: 实现 GroupListPage.tsx**

```tsx
// frontend/src/pages/GroupListPage.tsx
import { useEffect, useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, StaffGroup } from '../api/client';

export function GroupListPage() {
  const [groups, setGroups] = useState<StaffGroup[]>([]);
  const [name, setName] = useState('');

  const load = async () => setGroups(await api.groups.list());

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    await api.groups.create(name);
    setName('');
    await load();
  };

  const handleRename = async (id: string, currentName: string) => {
    const next = window.prompt('新的小组名称', currentName);
    if (!next) return;
    await api.groups.rename(id, next);
    await load();
  };

  const handleDelete = async (id: string) => {
    await api.groups.remove(id);
    await load();
  };

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-xl font-semibold">小组管理</h1>
      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          placeholder="小组名称"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border rounded px-3 py-2 flex-1"
          required
        />
        <button type="submit" className="bg-blue-600 text-white rounded px-4 py-2">
          创建小组
        </button>
      </form>
      <ul className="divide-y">
        {groups.map((g) => (
          <li key={g.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <p className="font-medium">{g.name}</p>
              <p className="text-sm text-gray-500">{g.memberCount} 名成员</p>
            </div>
            <div className="flex gap-2">
              <Link to={`/groups/${g.id}`} className="border rounded px-3 py-1 text-sm">
                管理成员
              </Link>
              <button onClick={() => handleRename(g.id, g.name)} className="border rounded px-3 py-1 text-sm">
                重命名
              </button>
              <button onClick={() => handleDelete(g.id)} className="border rounded px-3 py-1 text-sm text-red-600">
                删除
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd frontend && npx vitest run src/pages/__tests__/GroupListPage.test.tsx`
Expected: PASS

- [ ] **Step 5: 写失败的 GroupDetailPage 测试**

```tsx
// frontend/src/pages/__tests__/GroupDetailPage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { GroupDetailPage } from '../GroupDetailPage';
import { api } from '../../api/client';

vi.mock('../../api/client', () => ({
  api: {
    groups: { listMembers: vi.fn(), addMember: vi.fn(), removeMember: vi.fn() },
    staff: { list: vi.fn() },
  },
}));

describe('GroupDetailPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows members and staff available to add, and can add a member', async () => {
    (api.groups.listMembers as any).mockResolvedValue([{ id: 'staff-1', name: 'Alice' }]);
    (api.staff.list as any).mockResolvedValue([
      { id: 'staff-1', name: 'Alice' },
      { id: 'staff-2', name: 'Bob' },
    ]);
    (api.groups.addMember as any).mockResolvedValue(undefined);

    render(
      <MemoryRouter initialEntries={['/groups/group-1']}>
        <Routes>
          <Route path="/groups/:id" element={<GroupDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    expect(screen.getByText('Bob')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '加入' }));

    await waitFor(() => expect(api.groups.addMember).toHaveBeenCalledWith('group-1', 'staff-2'));
  });
});
```

- [ ] **Step 6: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/pages/__tests__/GroupDetailPage.test.tsx`
Expected: FAIL — `Cannot find module '../GroupDetailPage'`

- [ ] **Step 7: 实现 GroupDetailPage.tsx**

```tsx
// frontend/src/pages/GroupDetailPage.tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, Staff } from '../api/client';

export function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [members, setMembers] = useState<Staff[]>([]);
  const [allStaff, setAllStaff] = useState<Staff[]>([]);

  const load = async () => {
    if (!id) return;
    const [memberList, staffList] = await Promise.all([api.groups.listMembers(id), api.staff.list()]);
    setMembers(memberList);
    setAllStaff(staffList);
  };

  useEffect(() => {
    load();
  }, [id]);

  const memberIds = new Set(members.map((m) => m.id));
  const available = allStaff.filter((s) => !memberIds.has(s.id));

  const handleAdd = async (staffId: string) => {
    if (!id) return;
    await api.groups.addMember(id, staffId);
    await load();
  };

  const handleRemove = async (staffId: string) => {
    if (!id) return;
    await api.groups.removeMember(id, staffId);
    await load();
  };

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-xl font-semibold">小组成员</h1>
      <div>
        <h2 className="font-medium mb-2">组内成员</h2>
        <ul className="divide-y">
          {members.map((m) => (
            <li key={m.id} className="py-2 flex items-center justify-between">
              <span>{m.name}</span>
              <button onClick={() => handleRemove(m.id)} className="border rounded px-3 py-1 text-sm text-red-600">
                移出
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h2 className="font-medium mb-2">其他员工</h2>
        <ul className="divide-y">
          {available.map((s) => (
            <li key={s.id} className="py-2 flex items-center justify-between">
              <span>{s.name}</span>
              <button onClick={() => handleAdd(s.id)} className="border rounded px-3 py-1 text-sm">
                加入
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: 挂载路由到 App.tsx**

```tsx
// frontend/src/App.tsx — 顶部追加 import：
import { StaffListPage } from './pages/StaffListPage';
import { StaffEditPage } from './pages/StaffEditPage';
import { GroupListPage } from './pages/GroupListPage';
import { GroupDetailPage } from './pages/GroupDetailPage';

// 在 <Route path="/dashboard" .../> 之后追加：
        <Route
          path="/staff"
          element={
            <ProtectedRoute>
              <StaffListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff/:id"
          element={
            <ProtectedRoute>
              <StaffEditPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/groups"
          element={
            <ProtectedRoute>
              <GroupListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/groups/:id"
          element={
            <ProtectedRoute>
              <GroupDetailPage />
            </ProtectedRoute>
          }
        />
```

- [ ] **Step 9: 在 DashboardPage 加导航链接**

```tsx
// frontend/src/pages/DashboardPage.tsx — 用下面的内容整体替换
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">欢迎，{user?.email}</h1>
      <nav className="flex gap-4 text-sm">
        <Link to="/staff" className="underline">
          员工管理
        </Link>
        <Link to="/groups" className="underline">
          小组管理
        </Link>
      </nav>
      <button onClick={() => logout()} className="border rounded px-3 py-2">
        登出
      </button>
    </div>
  );
}
```

- [ ] **Step 10: 运行全部前端测试确认通过**

Run: `cd frontend && npm test`
Expected: PASS

- [ ] **Step 11: 手动验证（浏览器）**

打开 `/staff`，创建一个员工，进入编辑页设置 preference 并保存；打开 `/groups`，创建一个小组，进入成员管理页把刚创建的员工加入小组，再移出，确认列表实时更新，且在手机宽度（375px）下按钮和列表可正常点击操作。

- [ ] **Step 12: Commit**

```bash
git add frontend/src/pages/GroupListPage.tsx frontend/src/pages/GroupDetailPage.tsx frontend/src/App.tsx frontend/src/pages/DashboardPage.tsx frontend/src/pages/__tests__/GroupListPage.test.tsx frontend/src/pages/__tests__/GroupDetailPage.test.tsx
git commit -m "feat(frontend): add group pages and wire up navigation"
```

---

## Plan 2 完成检查

- [ ] 后端 `npm test` 全绿
- [ ] 前端 `npm test` 全绿
- [ ] 手动验证：员工增删改、preference 编辑、小组增删改名、成员增删全流程走通
- [ ] 所有 Task 已 commit
