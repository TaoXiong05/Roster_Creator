# Roster Creator — Plan 1: 项目脚手架 + 认证 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建前后端项目骨架，实现完整认证体系（Google OAuth + 邮箱密码注册登录 + 密码重置），产出一个可以登录/注册/重置密码并到达受保护 Dashboard 页面的最小可用应用。

**Architecture:** 后端 Express + TypeScript REST API，Prisma 连接 Postgres（`DATABASE_URL` 环境变量，供应商任意）；认证用 JWT 存 httpOnly cookie，Google OAuth 走 Passport strategy + 手写本地邮箱密码校验；前端 Vite + React + TypeScript + Tailwind SPA，React Router 做路由与受保护路由。

**Tech Stack:** Express, TypeScript, Prisma, Postgres, Passport (google-oauth20), bcryptjs, jsonwebtoken, Resend, Vite, React, React Router, Tailwind CSS, Vitest, Supertest, React Testing Library

**Spec:** [docs/superpowers/specs/2026-08-18-roster-creator-design.md](../specs/2026-08-18-roster-creator-design.md)

## Global Constraints

- 密码最短长度 6 位，不做额外复杂度校验（spec 4）
- JWT 存 httpOnly cookie，`sameSite: 'lax'`（spec 2, 4）
- 密码重置 token 20 分钟有效期，一次性使用（spec 4）
- 单用户 = 独立数据（spec 1），所有资源表都带 `userId` 外键
- 数据库通过 `DATABASE_URL` 环境变量连接，代码不写死供应商（spec 2）
- 后端部署 Render Web Service，前端部署 Render Static Site（spec 9）
- TypeScript `strict: true`

---

## 文件结构总览

```
backend/
  package.json, tsconfig.json, .env.example
  prisma/schema.prisma
  src/
    app.ts, index.ts, db.ts
    auth/
      password.ts, jwt.ts, middleware.ts
      routes.ts, googleRoutes.ts, passport.ts, passwordReset.ts
      __tests__/*.test.ts
    email/
      resend.ts

frontend/
  package.json, vite.config.ts, tailwind.config.js, postcss.config.js, index.html
  src/
    main.tsx, App.tsx
    api/client.ts
    auth/AuthContext.tsx, auth/ProtectedRoute.tsx
    pages/LoginPage.tsx, RegisterPage.tsx, ForgotPasswordPage.tsx,
          ResetPasswordPage.tsx, DashboardPage.tsx
    __tests__/*.test.tsx
```

---

### Task 1: 后端项目脚手架 + 健康检查

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/.env.example`
- Create: `backend/src/app.ts`
- Create: `backend/src/index.ts`
- Test: `backend/src/__tests__/app.health.test.ts`

**Interfaces:**
- Produces: `createApp(): express.Express` — 后续所有任务都在这个 app 上挂载路由

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "roster-creator-backend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev"
  },
  "dependencies": {
    "express": "^4.19.2",
    "@prisma/client": "^5.20.0",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "passport": "^0.7.0",
    "passport-google-oauth20": "^2.0.0",
    "cookie-parser": "^1.4.6",
    "cors": "^2.8.5",
    "resend": "^4.0.0",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "typescript": "^5.6.2",
    "tsx": "^4.19.1",
    "vitest": "^2.1.1",
    "supertest": "^7.0.0",
    "@types/express": "^4.17.21",
    "@types/node": "^22.7.0",
    "@types/cookie-parser": "^1.4.7",
    "@types/cors": "^2.8.17",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/passport": "^1.0.16",
    "@types/passport-google-oauth20": "^2.0.16",
    "@types/supertest": "^6.0.2",
    "prisma": "^5.20.0"
  }
}
```

- [ ] **Step 2: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "sourceMap": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: 创建 .env.example**

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/roster_creator
JWT_SECRET=change-me-in-production
PORT=4000
FRONTEND_URL=http://localhost:5173
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:4000/auth/google/callback
RESEND_API_KEY=
RESEND_FROM_EMAIL=onboarding@resend.dev
AI_BASE_URL=
AI_API_KEY=
AI_MODEL=
```

- [ ] **Step 4: 写失败的健康检查测试**

```ts
// backend/src/__tests__/app.health.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';

describe('GET /health', () => {
  it('returns ok status', async () => {
    const app = createApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
```

- [ ] **Step 5: 运行测试确认失败**

Run: `cd backend && npm install && npm test`
Expected: FAIL — `Cannot find module '../app'`

- [ ] **Step 6: 实现 app.ts**

```ts
// backend/src/app.ts
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';

export function createApp() {
  const app = express();
  app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  return app;
}
```

- [ ] **Step 7: 创建 index.ts（启动入口，不参与测试）**

```ts
// backend/src/index.ts
import 'dotenv/config';
import { createApp } from './app';

const PORT = process.env.PORT || 4000;
const app = createApp();
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
```

- [ ] **Step 8: 运行测试确认通过**

Run: `cd backend && npm test`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add backend/package.json backend/tsconfig.json backend/.env.example backend/src/app.ts backend/src/index.ts backend/src/__tests__/app.health.test.ts
git commit -m "feat(backend): scaffold express app with health check"
```

---

### Task 2: Prisma schema（全量数据模型）+ 迁移

**Files:**
- Create: `backend/prisma/schema.prisma`
- Create: `backend/src/db.ts`

**Interfaces:**
- Produces: `prisma` (PrismaClient singleton, exported from `backend/src/db.ts`)，以及 spec 第 3 节中列出的全部模型：`User`, `Staff`, `Preference`, `StaffGroup`, `GroupMember`, `ShiftTemplate`, `Roster`, `RosterShift`, `Assignment`, `PasswordResetToken`。后续所有计划（Plan 2-5）都基于这份 schema。

- [ ] **Step 1: 编写完整 schema.prisma**

```prisma
// backend/prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String?
  googleId     String?  @unique
  createdAt    DateTime @default(now())

  staff               Staff[]
  staffGroups         StaffGroup[]
  shiftTemplates      ShiftTemplate[]
  rosters             Roster[]
  passwordResetTokens PasswordResetToken[]
}

model Staff {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name      String
  email     String
  skills    String[]
  createdAt DateTime @default(now())

  preference   Preference?
  groupMembers GroupMember[]
  assignments  Assignment[]
}

model Preference {
  id                        String   @id @default(uuid())
  staffId                   String   @unique
  staff                     Staff    @relation(fields: [staffId], references: [id], onDelete: Cascade)
  preferredShiftTemplateIds String[]
  unavailableDateRanges     Json
  minHoursPerWeek           Float
  maxHoursPerWeek           Float
  preferredWeekdays         Int[]
}

model StaffGroup {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name      String
  createdAt DateTime @default(now())

  members GroupMember[]
  rosters Roster[]
}

model GroupMember {
  groupId String
  staffId String
  group   StaffGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  staff   Staff      @relation(fields: [staffId], references: [id], onDelete: Cascade)

  @@id([groupId, staffId])
}

model ShiftTemplate {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name      String
  startTime String
  endTime   String
  createdAt DateTime @default(now())

  rosterShifts RosterShift[]
}

model Roster {
  id             String     @id @default(uuid())
  userId         String
  user           User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  name           String
  dateRangeStart DateTime
  dateRangeEnd   DateTime
  groupId        String
  group          StaffGroup @relation(fields: [groupId], references: [id])
  status         String     @default("draft")
  createdAt      DateTime   @default(now())

  rosterShifts RosterShift[]
}

model RosterShift {
  id              String        @id @default(uuid())
  rosterId        String
  roster          Roster        @relation(fields: [rosterId], references: [id], onDelete: Cascade)
  shiftTemplateId String
  shiftTemplate   ShiftTemplate @relation(fields: [shiftTemplateId], references: [id])
  date            DateTime
  headcount       Int
  requiredSkills  String[]

  assignments Assignment[]
}

model Assignment {
  id            String      @id @default(uuid())
  rosterShiftId String
  rosterShift   RosterShift @relation(fields: [rosterShiftId], references: [id], onDelete: Cascade)
  staffId       String?
  staff         Staff?      @relation(fields: [staffId], references: [id])
  unfilledTag   String?
}

model PasswordResetToken {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String
  expiresAt DateTime
}
```

- [ ] **Step 2: 创建 db.ts**

```ts
// backend/src/db.ts
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
```

- [ ] **Step 3: 生成 Prisma Client**

Run: `cd backend && npx prisma generate`
Expected: `Generated Prisma Client` 成功输出，无报错

- [ ] **Step 4: 创建迁移（需要 DATABASE_URL 指向一个可用的 Postgres 实例）**

Run: `cd backend && npx prisma migrate dev --name init`
Expected: 迁移文件生成在 `backend/prisma/migrations/`，且所有表创建成功

- [ ] **Step 5: Commit**

```bash
git add backend/prisma backend/src/db.ts
git commit -m "feat(backend): add full prisma schema and migration"
```

---

### Task 3: 认证工具函数（密码哈希 + JWT）

**Files:**
- Create: `backend/src/auth/password.ts`
- Create: `backend/src/auth/jwt.ts`
- Test: `backend/src/auth/__tests__/password.test.ts`
- Test: `backend/src/auth/__tests__/jwt.test.ts`

**Interfaces:**
- Produces: `hashPassword(plain: string): Promise<string>`, `verifyPassword(plain: string, hash: string): Promise<boolean>`
- Produces: `signToken(payload: { userId: string }): string`, `verifyToken(token: string): { userId: string } | null`

- [ ] **Step 1: 写失败的密码哈希测试**

```ts
// backend/src/auth/__tests__/password.test.ts
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../password';

describe('password hashing', () => {
  it('hashes a password and verifies it correctly', async () => {
    const hash = await hashPassword('mysecret123');
    expect(hash).not.toBe('mysecret123');
    const ok = await verifyPassword('mysecret123', hash);
    expect(ok).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('mysecret123');
    const ok = await verifyPassword('wrongpassword', hash);
    expect(ok).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && npx vitest run src/auth/__tests__/password.test.ts`
Expected: FAIL — `Cannot find module '../password'`

- [ ] **Step 3: 实现 password.ts**

```ts
// backend/src/auth/password.ts
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd backend && npx vitest run src/auth/__tests__/password.test.ts`
Expected: PASS

- [ ] **Step 5: 写失败的 JWT 测试**

```ts
// backend/src/auth/__tests__/jwt.test.ts
import { describe, it, expect } from 'vitest';
import { signToken, verifyToken } from '../jwt';

describe('jwt', () => {
  it('signs and verifies a valid token', () => {
    const token = signToken({ userId: 'user-1' });
    const payload = verifyToken(token);
    expect(payload).toEqual({ userId: 'user-1' });
  });

  it('returns null for an invalid token', () => {
    const payload = verifyToken('not-a-real-token');
    expect(payload).toBeNull();
  });
});
```

- [ ] **Step 6: 运行测试确认失败**

Run: `cd backend && npx vitest run src/auth/__tests__/jwt.test.ts`
Expected: FAIL — `Cannot find module '../jwt'`

- [ ] **Step 7: 实现 jwt.ts**

```ts
// backend/src/auth/jwt.ts
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const EXPIRES_IN = '7d';

export interface TokenPayload {
  userId: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: EXPIRES_IN });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return { userId: decoded.userId };
  } catch {
    return null;
  }
}
```

- [ ] **Step 8: 运行全部测试确认通过**

Run: `cd backend && npm test`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add backend/src/auth/password.ts backend/src/auth/jwt.ts backend/src/auth/__tests__/password.test.ts backend/src/auth/__tests__/jwt.test.ts
git commit -m "feat(backend): add password hashing and jwt utilities"
```

---

### Task 4: 注册 / 登录 / 登出 / /me 端点

**Files:**
- Create: `backend/src/auth/middleware.ts`
- Create: `backend/src/auth/routes.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/src/auth/__tests__/routes.test.ts`

**Interfaces:**
- Consumes: `hashPassword`, `verifyPassword` from `../password`；`signToken` from `../jwt`；`prisma` from `../../db`
- Produces: `requireAuth(req, res, next)` middleware，挂载到 `req.userId`；`authRouter` (Express Router)，挂载于 `/auth`：`POST /register`, `POST /login`, `POST /logout`, `GET /me`

- [ ] **Step 1: 写失败的路由测试**

```ts
// backend/src/auth/__tests__/routes.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { prisma } from '../../db';
import { createApp } from '../../app';
import { hashPassword } from '../password';

const app = createApp();

describe('POST /auth/register', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a new user and sets a cookie', async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    (prisma.user.create as any).mockResolvedValue({ id: 'user-1', email: 'a@b.com' });

    const res = await request(app).post('/auth/register').send({ email: 'a@b.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: 'user-1', email: 'a@b.com' });
    expect(res.headers['set-cookie'][0]).toMatch(/token=/);
  });

  it('rejects duplicate email', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: 'existing' });

    const res = await request(app).post('/auth/register').send({ email: 'a@b.com', password: 'password123' });

    expect(res.status).toBe(409);
  });

  it('rejects short password', async () => {
    const res = await request(app).post('/auth/register').send({ email: 'a@b.com', password: '123' });
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/login', () => {
  beforeEach(() => vi.clearAllMocks());

  it('logs in with correct credentials', async () => {
    const passwordHash = await hashPassword('password123');
    (prisma.user.findUnique as any).mockResolvedValue({ id: 'user-1', email: 'a@b.com', passwordHash });

    const res = await request(app).post('/auth/login').send({ email: 'a@b.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.headers['set-cookie'][0]).toMatch(/token=/);
  });

  it('rejects wrong password', async () => {
    const passwordHash = await hashPassword('password123');
    (prisma.user.findUnique as any).mockResolvedValue({ id: 'user-1', email: 'a@b.com', passwordHash });

    const res = await request(app).post('/auth/login').send({ email: 'a@b.com', password: 'wrongpass' });

    expect(res.status).toBe(401);
  });

  it('rejects unknown email', async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);

    const res = await request(app).post('/auth/login').send({ email: 'nope@b.com', password: 'password123' });

    expect(res.status).toBe(401);
  });
});

describe('GET /auth/me', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects when not authenticated', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns the current user when authenticated', async () => {
    const passwordHash = await hashPassword('password123');
    (prisma.user.findUnique as any).mockResolvedValue({ id: 'user-1', email: 'a@b.com', passwordHash });

    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'a@b.com', password: 'password123' });

    const res = await agent.get('/auth/me');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 'user-1', email: 'a@b.com' });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && npx vitest run src/auth/__tests__/routes.test.ts`
Expected: FAIL — `Cannot find module '../../app'` 或路由不存在

- [ ] **Step 3: 实现 middleware.ts**

```ts
// backend/src/auth/middleware.ts
import { Request, Response, NextFunction } from 'express';
import { verifyToken } from './jwt';

export interface AuthedRequest extends Request {
  userId?: string;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  req.userId = payload.userId;
  next();
}
```

- [ ] **Step 4: 实现 routes.ts**

```ts
// backend/src/auth/routes.ts
import { Router } from 'express';
import { prisma } from '../db';
import { hashPassword, verifyPassword } from './password';
import { signToken } from './jwt';
import { requireAuth, AuthedRequest } from './middleware';

export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password || password.length < 6) {
    return res.status(400).json({ error: 'Email and password (min 6 chars) are required' });
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({ data: { email, passwordHash } });
  const token = signToken({ userId: user.id });
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax' });
  res.status(201).json({ id: user.id, email: user.email });
});

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = signToken({ userId: user.id });
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax' });
  res.json({ id: user.id, email: user.email });
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie('token');
  res.status(204).send();
});

authRouter.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, email: user.email });
});
```

- [ ] **Step 5: 把 authRouter 挂载进 app.ts**

```ts
// backend/src/app.ts
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { authRouter } from './auth/routes';

export function createApp() {
  const app = express();
  app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/auth', authRouter);

  return app;
}
```

- [ ] **Step 6: 运行测试确认通过**

Run: `cd backend && npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/src/auth/middleware.ts backend/src/auth/routes.ts backend/src/app.ts backend/src/auth/__tests__/routes.test.ts
git commit -m "feat(backend): add register, login, logout, me endpoints"
```

---

### Task 5: Google OAuth

**Files:**
- Create: `backend/src/auth/passport.ts`
- Create: `backend/src/auth/googleRoutes.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/src/auth/__tests__/passport.test.ts`
- Test: `backend/src/auth/__tests__/googleRoutes.test.ts`

**Interfaces:**
- Consumes: `prisma` from `../db`, `signToken` from `./jwt`
- Produces: `findOrCreateGoogleUser(profile): Promise<User>`；`googleAuthRouter` 挂载 `GET /google`, `GET /google/callback`；`handleGoogleCallback(req, res)` 可单独测试的回调处理函数

- [ ] **Step 1: 写失败的 findOrCreateGoogleUser 测试**

```ts
// backend/src/auth/__tests__/passport.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from '../../db';
import { findOrCreateGoogleUser } from '../passport';

const profile = { id: 'google-1', emails: [{ value: 'a@b.com' }] } as any;

describe('findOrCreateGoogleUser', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns existing user matched by googleId', async () => {
    (prisma.user.findUnique as any).mockResolvedValueOnce({ id: 'user-1', googleId: 'google-1' });

    const user = await findOrCreateGoogleUser(profile);

    expect(user).toEqual({ id: 'user-1', googleId: 'google-1' });
  });

  it('links googleId to an existing email-only user', async () => {
    (prisma.user.findUnique as any)
      .mockResolvedValueOnce(null) // no match by googleId
      .mockResolvedValueOnce({ id: 'user-1', email: 'a@b.com', googleId: null }); // match by email
    (prisma.user.update as any).mockResolvedValue({ id: 'user-1', email: 'a@b.com', googleId: 'google-1' });

    const user = await findOrCreateGoogleUser(profile);

    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { googleId: 'google-1' } });
    expect(user.googleId).toBe('google-1');
  });

  it('creates a brand new user when none exists', async () => {
    (prisma.user.findUnique as any).mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    (prisma.user.create as any).mockResolvedValue({ id: 'user-2', email: 'a@b.com', googleId: 'google-1' });

    const user = await findOrCreateGoogleUser(profile);

    expect(prisma.user.create).toHaveBeenCalledWith({ data: { email: 'a@b.com', googleId: 'google-1' } });
    expect(user.id).toBe('user-2');
  });

  it('throws when the google profile has no email', async () => {
    await expect(findOrCreateGoogleUser({ id: 'google-1', emails: [] } as any)).rejects.toThrow('no email');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && npx vitest run src/auth/__tests__/passport.test.ts`
Expected: FAIL — `Cannot find module '../passport'`

- [ ] **Step 3: 实现 passport.ts**

```ts
// backend/src/auth/passport.ts
import passport from 'passport';
import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20';
import { prisma } from '../db';

export async function findOrCreateGoogleUser(profile: Profile) {
  const email = profile.emails?.[0]?.value;
  if (!email) throw new Error('Google account has no email');

  let user = await prisma.user.findUnique({ where: { googleId: profile.id } });
  if (!user) {
    user = await prisma.user.findUnique({ where: { email } });
  }
  if (!user) {
    user = await prisma.user.create({ data: { email, googleId: profile.id } });
  } else if (!user.googleId) {
    user = await prisma.user.update({ where: { id: user.id }, data: { googleId: profile.id } });
  }
  return user;
}

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/auth/google/callback',
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const user = await findOrCreateGoogleUser(profile);
        done(null, user);
      } catch (err) {
        done(err as Error);
      }
    }
  )
);

export { passport };
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd backend && npx vitest run src/auth/__tests__/passport.test.ts`
Expected: PASS

- [ ] **Step 5: 写失败的 googleRoutes 测试**

```ts
// backend/src/auth/__tests__/googleRoutes.test.ts
import { describe, it, expect, vi } from 'vitest';
import { handleGoogleCallback } from '../googleRoutes';

describe('handleGoogleCallback', () => {
  it('signs a JWT cookie and redirects to the dashboard', () => {
    const req = { user: { id: 'user-1' } } as any;
    const cookie = vi.fn();
    const redirect = vi.fn();
    const res = { cookie, redirect } as any;

    handleGoogleCallback(req, res);

    expect(cookie).toHaveBeenCalledWith('token', expect.any(String), expect.objectContaining({ httpOnly: true }));
    expect(redirect).toHaveBeenCalledWith(expect.stringContaining('/dashboard'));
  });
});
```

- [ ] **Step 6: 运行测试确认失败**

Run: `cd backend && npx vitest run src/auth/__tests__/googleRoutes.test.ts`
Expected: FAIL — `Cannot find module '../googleRoutes'`

- [ ] **Step 7: 实现 googleRoutes.ts**

```ts
// backend/src/auth/googleRoutes.ts
import { Router, Request, Response } from 'express';
import { passport } from './passport';
import { signToken } from './jwt';

export const googleAuthRouter = Router();

export function handleGoogleCallback(req: Request, res: Response) {
  const user = req.user as { id: string };
  const token = signToken({ userId: user.id });
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax' });
  res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard`);
}

googleAuthRouter.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

googleAuthRouter.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  handleGoogleCallback
);
```

- [ ] **Step 8: 挂载 googleAuthRouter 到 app.ts**

```ts
// backend/src/app.ts — 在 app.use('/auth', authRouter) 之后加一行
  app.use('/auth', googleAuthRouter);
```

同时在文件顶部加 `import { googleAuthRouter } from './auth/googleRoutes';`

- [ ] **Step 9: 运行全部测试确认通过**

Run: `cd backend && npm test`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add backend/src/auth/passport.ts backend/src/auth/googleRoutes.ts backend/src/app.ts backend/src/auth/__tests__/passport.test.ts backend/src/auth/__tests__/googleRoutes.test.ts
git commit -m "feat(backend): add google oauth login"
```

---

### Task 6: 密码重置（请求 + 确认）+ Resend 邮件

**Files:**
- Create: `backend/src/email/resend.ts`
- Create: `backend/src/auth/passwordReset.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/src/auth/__tests__/passwordReset.test.ts`

**Interfaces:**
- Consumes: `prisma` from `../db`, `hashPassword` from `./password`
- Produces: `sendEmail({ to, subject, html }): Promise<void>`（后续 Plan 5 邮件发送排班表也复用这个函数）；`passwordResetRouter` 挂载于 `/auth`：`POST /password-reset/request`, `POST /password-reset/confirm`

- [ ] **Step 1: 实现 resend.ts（无需先测试，是第三方 SDK 的薄封装）**

```ts
// backend/src/email/resend.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<void> {
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
    to,
    subject,
    html,
  });
}
```

- [ ] **Step 2: 写失败的密码重置测试**

```ts
// backend/src/auth/__tests__/passwordReset.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../db', () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    passwordResetToken: { create: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
  },
}));
vi.mock('../../email/resend', () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));

import { prisma } from '../../db';
import { sendEmail } from '../../email/resend';
import { createApp } from '../../app';

const app = createApp();

describe('POST /auth/password-reset/request', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends a reset email for an existing password user', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: 'user-1', email: 'a@b.com', passwordHash: 'hash' });
    (prisma.passwordResetToken.create as any).mockResolvedValue({ id: 'token-1' });

    const res = await request(app).post('/auth/password-reset/request').send({ email: 'a@b.com' });

    expect(res.status).toBe(202);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'a@b.com', subject: expect.any(String) })
    );
  });

  it('returns 202 without sending email when user does not exist (avoid leaking)', async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);

    const res = await request(app).post('/auth/password-reset/request').send({ email: 'nope@b.com' });

    expect(res.status).toBe(202);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe('POST /auth/password-reset/confirm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects an unknown token', async () => {
    (prisma.passwordResetToken.findFirst as any).mockResolvedValue(null);

    const res = await request(app).post('/auth/password-reset/confirm').send({ token: 'bad', password: 'newpass123' });

    expect(res.status).toBe(400);
  });

  it('rejects an expired token', async () => {
    (prisma.passwordResetToken.findFirst as any).mockResolvedValue({
      id: 'token-1',
      userId: 'user-1',
      expiresAt: new Date(Date.now() - 1000),
    });

    const res = await request(app).post('/auth/password-reset/confirm').send({ token: 'expired', password: 'newpass123' });

    expect(res.status).toBe(400);
  });

  it('resets the password with a valid token', async () => {
    (prisma.passwordResetToken.findFirst as any).mockResolvedValue({
      id: 'token-1',
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 1000 * 60),
    });
    (prisma.user.update as any).mockResolvedValue({ id: 'user-1' });
    (prisma.passwordResetToken.delete as any).mockResolvedValue({ id: 'token-1' });

    const res = await request(app).post('/auth/password-reset/confirm').send({ token: 'valid', password: 'newpass123' });

    expect(res.status).toBe(204);
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { passwordHash: expect.any(String) } });
    expect(prisma.passwordResetToken.delete).toHaveBeenCalledWith({ where: { id: 'token-1' } });
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `cd backend && npx vitest run src/auth/__tests__/passwordReset.test.ts`
Expected: FAIL — `Cannot find module '../passwordReset'`

- [ ] **Step 4: 实现 passwordReset.ts**

```ts
// backend/src/auth/passwordReset.ts
import { Router } from 'express';
import crypto from 'crypto';
import { prisma } from '../db';
import { hashPassword } from './password';
import { sendEmail } from '../email/resend';

export const passwordResetRouter = Router();

const RESET_TOKEN_TTL_MS = 20 * 60 * 1000;

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

passwordResetRouter.post('/password-reset/request', async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    return res.status(202).json({ message: 'If that email exists, a reset link was sent' });
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } });

  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${rawToken}`;
  await sendEmail({
    to: email,
    subject: '重置你的密码',
    html: `<p>点击链接重置密码（20 分钟内有效）：</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
  });

  res.status(202).json({ message: 'If that email exists, a reset link was sent' });
});

passwordResetRouter.post('/password-reset/confirm', async (req, res) => {
  const { token, password } = req.body as { token?: string; password?: string };
  if (!token || !password || password.length < 6) {
    return res.status(400).json({ error: 'Token and password (min 6 chars) are required' });
  }

  const tokenHash = hashToken(token);
  const record = await prisma.passwordResetToken.findFirst({ where: { tokenHash } });
  if (!record || record.expiresAt < new Date()) {
    return res.status(400).json({ error: 'Invalid or expired reset token' });
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.update({ where: { id: record.userId }, data: { passwordHash } });
  await prisma.passwordResetToken.delete({ where: { id: record.id } });

  res.status(204).send();
});
```

- [ ] **Step 5: 挂载 passwordResetRouter 到 app.ts**

```ts
// backend/src/app.ts — 加在 app.use('/auth', googleAuthRouter) 之后
  app.use('/auth', passwordResetRouter);
```

同时顶部加 `import { passwordResetRouter } from './auth/passwordReset';`

- [ ] **Step 6: 运行全部测试确认通过**

Run: `cd backend && npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/src/email/resend.ts backend/src/auth/passwordReset.ts backend/src/app.ts backend/src/auth/__tests__/passwordReset.test.ts
git commit -m "feat(backend): add password reset flow with resend email"
```

---

### Task 7: 前端脚手架 + API client

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tailwind.config.js`
- Create: `frontend/postcss.config.js`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/index.css`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/api/client.ts`
- Test: `frontend/src/api/__tests__/client.test.ts`

**Interfaces:**
- Produces: `api.register/login/logout/me/requestPasswordReset/confirmPasswordReset` — 后续所有页面任务都调用这个对象

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "roster-creator-frontend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.2"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.1",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.9",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.20",
    "jsdom": "^25.0.1",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.13",
    "typescript": "^5.6.2",
    "vite": "^5.4.8",
    "vitest": "^2.1.1"
  }
}
```

- [ ] **Step 2: 创建 vite.config.ts（含 vitest 配置）**

```ts
// frontend/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    globals: true,
  },
});
```

- [ ] **Step 3: 创建 setupTests.ts**

```ts
// frontend/src/setupTests.ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 4: 创建 tailwind.config.js 和 postcss.config.js**

```js
// frontend/tailwind.config.js
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
```

```js
// frontend/postcss.config.js
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

- [ ] **Step 5: 创建 index.html, main.tsx, index.css, App.tsx（占位首页）**

```html
<!-- frontend/index.html -->
<!doctype html>
<html lang="zh">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Roster Creator</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

```css
/* frontend/src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

```tsx
// frontend/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

```tsx
// frontend/src/App.tsx
export default function App() {
  return <div className="p-4">Roster Creator</div>;
}
```

- [ ] **Step 6: 写失败的 api client 测试**

```ts
// frontend/src/api/__tests__/client.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '../client';

describe('api.login', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('posts credentials and returns the user on success', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'user-1', email: 'a@b.com' }),
    });

    const user = await api.login('a@b.com', 'password123');

    expect(user).toEqual({ id: 'user-1', email: 'a@b.com' });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/login'),
      expect.objectContaining({ method: 'POST', credentials: 'include' })
    );
  });

  it('throws the server error message on failure', async () => {
    (fetch as any).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Invalid credentials' }),
    });

    await expect(api.login('a@b.com', 'wrong')).rejects.toThrow('Invalid credentials');
  });
});
```

- [ ] **Step 7: 运行测试确认失败**

Run: `cd frontend && npm install && npm test`
Expected: FAIL — `Cannot find module '../client'`

- [ ] **Step 8: 实现 api/client.ts**

```ts
// frontend/src/api/client.ts
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export interface ApiError {
  error: string;
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({ error: 'Request failed' }))) as ApiError;
    throw new Error(body.error || 'Request failed');
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface User {
  id: string;
  email: string;
}

export const api = {
  register: (email: string, password: string) =>
    apiRequest<User>('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }),
  login: (email: string, password: string) =>
    apiRequest<User>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => apiRequest<void>('/auth/logout', { method: 'POST' }),
  me: () => apiRequest<User>('/auth/me'),
  requestPasswordReset: (email: string) =>
    apiRequest<void>('/auth/password-reset/request', { method: 'POST', body: JSON.stringify({ email }) }),
  confirmPasswordReset: (token: string, password: string) =>
    apiRequest<void>('/auth/password-reset/confirm', { method: 'POST', body: JSON.stringify({ token, password }) }),
};
```

- [ ] **Step 9: 运行测试确认通过**

Run: `cd frontend && npm test`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add frontend/package.json frontend/vite.config.ts frontend/tailwind.config.js frontend/postcss.config.js frontend/index.html frontend/src
git commit -m "feat(frontend): scaffold vite react app with api client"
```

---

### Task 8: AuthContext + ProtectedRoute

**Files:**
- Create: `frontend/src/auth/AuthContext.tsx`
- Create: `frontend/src/auth/ProtectedRoute.tsx`
- Test: `frontend/src/auth/__tests__/AuthContext.test.tsx`
- Test: `frontend/src/auth/__tests__/ProtectedRoute.test.tsx`

**Interfaces:**
- Consumes: `api` from `../api/client`
- Produces: `AuthProvider`, `useAuth(): { user, loading, login, register, logout }`, `ProtectedRoute`

- [ ] **Step 1: 写失败的 AuthContext 测试**

```tsx
// frontend/src/auth/__tests__/AuthContext.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';
import { api } from '../../api/client';

vi.mock('../../api/client', () => ({
  api: {
    me: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  },
}));

function Probe() {
  const { user, loading } = useAuth();
  if (loading) return <div>loading</div>;
  return <div>{user ? `logged in as ${user.email}` : 'logged out'}</div>;
}

describe('AuthProvider', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads the current user on mount', async () => {
    (api.me as any).mockResolvedValue({ id: 'user-1', email: 'a@b.com' });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText('logged in as a@b.com')).toBeInTheDocument());
  });

  it('shows logged out when /me fails', async () => {
    (api.me as any).mockRejectedValue(new Error('Not authenticated'));

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText('logged out')).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/auth/__tests__/AuthContext.test.tsx`
Expected: FAIL — `Cannot find module '../AuthContext'`

- [ ] **Step 3: 实现 AuthContext.tsx**

```tsx
// frontend/src/auth/AuthContext.tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, User } from '../api/client';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const u = await api.login(email, password);
    setUser(u);
  };

  const register = async (email: string, password: string) => {
    const u = await api.register(email, password);
    setUser(u);
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd frontend && npx vitest run src/auth/__tests__/AuthContext.test.tsx`
Expected: PASS

- [ ] **Step 5: 写失败的 ProtectedRoute 测试**

```tsx
// frontend/src/auth/__tests__/ProtectedRoute.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '../ProtectedRoute';
import * as AuthContextModule from '../AuthContext';

describe('ProtectedRoute', () => {
  it('redirects to /login when there is no user', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/login" element={<div>login page</div>} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <div>secret dashboard</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('login page')).toBeInTheDocument();
  });

  it('renders children when a user is present', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 'user-1', email: 'a@b.com' },
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <div>secret dashboard</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('secret dashboard')).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/auth/__tests__/ProtectedRoute.test.tsx`
Expected: FAIL — `Cannot find module '../ProtectedRoute'`

- [ ] **Step 7: 实现 ProtectedRoute.tsx**

```tsx
// frontend/src/auth/ProtectedRoute.tsx
import { Navigate } from 'react-router-dom';
import { ReactNode } from 'react';
import { useAuth } from './AuthContext';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-4">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
```

- [ ] **Step 8: 运行全部前端测试确认通过**

Run: `cd frontend && npm test`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add frontend/src/auth/AuthContext.tsx frontend/src/auth/ProtectedRoute.tsx frontend/src/auth/__tests__
git commit -m "feat(frontend): add auth context and protected route"
```

---

### Task 9: 登录 / 注册页面

**Files:**
- Create: `frontend/src/pages/LoginPage.tsx`
- Create: `frontend/src/pages/RegisterPage.tsx`
- Test: `frontend/src/pages/__tests__/LoginPage.test.tsx`
- Test: `frontend/src/pages/__tests__/RegisterPage.test.tsx`

**Interfaces:**
- Consumes: `useAuth()` from `../auth/AuthContext`

- [ ] **Step 1: 写失败的 LoginPage 测试**

```tsx
// frontend/src/pages/__tests__/LoginPage.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from '../LoginPage';
import * as AuthContextModule from '../../auth/AuthContext';

describe('LoginPage', () => {
  it('calls login with entered credentials and shows error on failure', async () => {
    const login = vi.fn().mockRejectedValue(new Error('Invalid credentials'));
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      loading: false,
      login,
      register: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await userEvent.type(screen.getByPlaceholderText('邮箱'), 'a@b.com');
    await userEvent.type(screen.getByPlaceholderText('密码'), 'wrongpass');
    await userEvent.click(screen.getByRole('button', { name: '登录' }));

    expect(login).toHaveBeenCalledWith('a@b.com', 'wrongpass');
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Invalid credentials'));
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/pages/__tests__/LoginPage.test.tsx`
Expected: FAIL — `Cannot find module '../LoginPage'`

- [ ] **Step 3: 实现 LoginPage.tsx**

```tsx
// frontend/src/pages/LoginPage.tsx
import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">登录</h1>
        {error && (
          <p role="alert" className="text-red-600 text-sm">
            {error}
          </p>
        )}
        <input
          type="email"
          placeholder="邮箱"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded px-3 py-2"
          required
        />
        <input
          type="password"
          placeholder="密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border rounded px-3 py-2"
          required
        />
        <button type="submit" className="w-full bg-blue-600 text-white rounded py-2">
          登录
        </button>
        <div className="flex justify-between text-sm">
          <Link to="/register">没有账号？注册</Link>
          <Link to="/forgot-password">忘记密码？</Link>
        </div>
        <a href={`${API_BASE}/auth/google`} className="block text-center border rounded py-2">
          使用 Google 登录
        </a>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd frontend && npx vitest run src/pages/__tests__/LoginPage.test.tsx`
Expected: PASS

- [ ] **Step 5: 写失败的 RegisterPage 测试**

```tsx
// frontend/src/pages/__tests__/RegisterPage.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { RegisterPage } from '../RegisterPage';
import * as AuthContextModule from '../../auth/AuthContext';

describe('RegisterPage', () => {
  it('calls register with entered credentials', async () => {
    const register = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      loading: false,
      login: vi.fn(),
      register,
      logout: vi.fn(),
    });

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    await userEvent.type(screen.getByPlaceholderText('邮箱'), 'a@b.com');
    await userEvent.type(screen.getByPlaceholderText('密码（至少6位）'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: '注册' }));

    await waitFor(() => expect(register).toHaveBeenCalledWith('a@b.com', 'password123'));
  });
});
```

- [ ] **Step 6: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/pages/__tests__/RegisterPage.test.tsx`
Expected: FAIL — `Cannot find module '../RegisterPage'`

- [ ] **Step 7: 实现 RegisterPage.tsx**

```tsx
// frontend/src/pages/RegisterPage.tsx
import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await register(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">注册</h1>
        {error && (
          <p role="alert" className="text-red-600 text-sm">
            {error}
          </p>
        )}
        <input
          type="email"
          placeholder="邮箱"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded px-3 py-2"
          required
        />
        <input
          type="password"
          placeholder="密码（至少6位）"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          className="w-full border rounded px-3 py-2"
          required
        />
        <button type="submit" className="w-full bg-blue-600 text-white rounded py-2">
          注册
        </button>
        <div className="text-sm">
          <Link to="/login">已有账号？登录</Link>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 8: 运行全部前端测试确认通过**

Run: `cd frontend && npm test`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add frontend/src/pages/LoginPage.tsx frontend/src/pages/RegisterPage.tsx frontend/src/pages/__tests__/LoginPage.test.tsx frontend/src/pages/__tests__/RegisterPage.test.tsx
git commit -m "feat(frontend): add login and register pages"
```

---

### Task 10: 忘记密码 / 重置密码页面

**Files:**
- Create: `frontend/src/pages/ForgotPasswordPage.tsx`
- Create: `frontend/src/pages/ResetPasswordPage.tsx`
- Test: `frontend/src/pages/__tests__/ForgotPasswordPage.test.tsx`
- Test: `frontend/src/pages/__tests__/ResetPasswordPage.test.tsx`

**Interfaces:**
- Consumes: `api.requestPasswordReset`, `api.confirmPasswordReset` from `../api/client`

- [ ] **Step 1: 写失败的 ForgotPasswordPage 测试**

```tsx
// frontend/src/pages/__tests__/ForgotPasswordPage.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ForgotPasswordPage } from '../ForgotPasswordPage';
import { api } from '../../api/client';

vi.mock('../../api/client', () => ({ api: { requestPasswordReset: vi.fn() } }));

describe('ForgotPasswordPage', () => {
  it('submits the email and shows a confirmation message', async () => {
    (api.requestPasswordReset as any).mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>
    );

    await userEvent.type(screen.getByPlaceholderText('邮箱'), 'a@b.com');
    await userEvent.click(screen.getByRole('button', { name: '发送重置链接' }));

    expect(api.requestPasswordReset).toHaveBeenCalledWith('a@b.com');
    await waitFor(() => expect(screen.getByText(/如果该邮箱存在/)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/pages/__tests__/ForgotPasswordPage.test.tsx`
Expected: FAIL — `Cannot find module '../ForgotPasswordPage'`

- [ ] **Step 3: 实现 ForgotPasswordPage.tsx**

```tsx
// frontend/src/pages/ForgotPasswordPage.tsx
import { useState, FormEvent } from 'react';
import { api } from '../api/client';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await api.requestPasswordReset(email);
    setSent(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">忘记密码</h1>
        {sent ? (
          <p>如果该邮箱存在，我们已经发送了重置链接，请查收邮件。</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              placeholder="邮箱"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
            />
            <button type="submit" className="w-full bg-blue-600 text-white rounded py-2">
              发送重置链接
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd frontend && npx vitest run src/pages/__tests__/ForgotPasswordPage.test.tsx`
Expected: PASS

- [ ] **Step 5: 写失败的 ResetPasswordPage 测试**

```tsx
// frontend/src/pages/__tests__/ResetPasswordPage.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ResetPasswordPage } from '../ResetPasswordPage';
import { api } from '../../api/client';

vi.mock('../../api/client', () => ({ api: { confirmPasswordReset: vi.fn() } }));

describe('ResetPasswordPage', () => {
  it('reads the token from the query string and submits the new password', async () => {
    (api.confirmPasswordReset as any).mockResolvedValue(undefined);

    render(
      <MemoryRouter initialEntries={['/reset-password?token=abc123']}>
        <ResetPasswordPage />
      </MemoryRouter>
    );

    await userEvent.type(screen.getByPlaceholderText('新密码（至少6位）'), 'newpassword123');
    await userEvent.click(screen.getByRole('button', { name: '重置密码' }));

    await waitFor(() => expect(api.confirmPasswordReset).toHaveBeenCalledWith('abc123', 'newpassword123'));
    expect(screen.getByText(/密码已重置/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/pages/__tests__/ResetPasswordPage.test.tsx`
Expected: FAIL — `Cannot find module '../ResetPasswordPage'`

- [ ] **Step 7: 实现 ResetPasswordPage.tsx**

```tsx
// frontend/src/pages/ResetPasswordPage.tsx
import { useState, FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.confirmPasswordReset(token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">重置密码</h1>
        {done ? (
          <p>密码已重置，请用新密码登录。</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <p role="alert" className="text-red-600 text-sm">
                {error}
              </p>
            )}
            <input
              type="password"
              placeholder="新密码（至少6位）"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              className="w-full border rounded px-3 py-2"
              required
            />
            <button type="submit" className="w-full bg-blue-600 text-white rounded py-2">
              重置密码
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 8: 运行全部前端测试确认通过**

Run: `cd frontend && npm test`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add frontend/src/pages/ForgotPasswordPage.tsx frontend/src/pages/ResetPasswordPage.tsx frontend/src/pages/__tests__/ForgotPasswordPage.test.tsx frontend/src/pages/__tests__/ResetPasswordPage.test.tsx
git commit -m "feat(frontend): add forgot/reset password pages"
```

---

### Task 11: Dashboard 占位页 + 路由整合

**Files:**
- Create: `frontend/src/pages/DashboardPage.tsx`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/src/pages/__tests__/DashboardPage.test.tsx`
- Test: `frontend/src/__tests__/App.test.tsx`

**Interfaces:**
- Consumes: `useAuth()` from `../auth/AuthContext`；所有 Task 9-10 的页面组件；`ProtectedRoute` from `../auth/ProtectedRoute`

- [ ] **Step 1: 写失败的 DashboardPage 测试**

```tsx
// frontend/src/pages/__tests__/DashboardPage.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardPage } from '../DashboardPage';
import * as AuthContextModule from '../../auth/AuthContext';

describe('DashboardPage', () => {
  it('shows the logged-in user email', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 'user-1', email: 'a@b.com' },
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });

    render(<DashboardPage />);

    expect(screen.getByText(/a@b.com/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/pages/__tests__/DashboardPage.test.tsx`
Expected: FAIL — `Cannot find module '../DashboardPage'`

- [ ] **Step 3: 实现 DashboardPage.tsx**

```tsx
// frontend/src/pages/DashboardPage.tsx
import { useAuth } from '../auth/AuthContext';

export function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">欢迎，{user?.email}</h1>
      <p className="text-gray-500">员工管理、排班创建等功能将在后续计划中加入这里。</p>
      <button onClick={() => logout()} className="border rounded px-3 py-2">
        登出
      </button>
    </div>
  );
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd frontend && npx vitest run src/pages/__tests__/DashboardPage.test.tsx`
Expected: PASS

- [ ] **Step 5: 写失败的 App 路由测试**

```tsx
// frontend/src/__tests__/App.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import * as AuthContextModule from '../auth/AuthContext';

describe('App routing', () => {
  it('renders the login page at /login', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: '登录' })).toBeInTheDocument();
  });

  it('redirects unauthenticated users away from /dashboard', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: '登录' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: 运行测试确认失败**

Run: `cd frontend && npx vitest run src/__tests__/App.test.tsx`
Expected: FAIL — App 还没有接入路由，找不到"登录"标题

- [ ] **Step 7: 实现最终 App.tsx**

```tsx
// frontend/src/App.tsx
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { DashboardPage } from './pages/DashboardPage';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<LoginPage />} />
      </Routes>
    </AuthProvider>
  );
}
```

- [ ] **Step 8: 运行全部前端测试确认通过**

Run: `cd frontend && npm test`
Expected: PASS

- [ ] **Step 9: 手动验证（浏览器）**

Run: `cd backend && npm run dev` (另一个终端) `cd frontend && npm run dev`
打开 `http://localhost:5173/register`，注册一个账号 → 应自动跳转到 `/dashboard` 并显示邮箱。
再打开 `http://localhost:5173/login`，用刚注册的账号登录 → 同样跳转到 `/dashboard`。
Google 登录需要先在 `.env` 填入真实的 `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` 才能手动验证，若暂无凭证可跳过，仅确认按钮跳转到正确的 `/auth/google` URL。

- [ ] **Step 10: Commit**

```bash
git add frontend/src/pages/DashboardPage.tsx frontend/src/App.tsx frontend/src/pages/__tests__/DashboardPage.test.tsx frontend/src/__tests__/App.test.tsx
git commit -m "feat(frontend): wire up routing with dashboard and protected route"
```

---

## Plan 1 完成检查

- [ ] 后端 `npm test` 全绿
- [ ] 前端 `npm test` 全绿
- [ ] 手动验证：注册、登录、登出、忘记密码请求、重置密码全流程走通
- [ ] 所有 Task 已 commit
