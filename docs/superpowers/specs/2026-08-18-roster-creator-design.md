# Roster Creator — 设计文档

**日期：** 2026-08-18
**状态：** 已通过用户确认，待写实施计划

## 1. 概述

一个排班表 Web 应用。用户（店铺/团队管理者）登录后管理员工、定义班次模板、创建排班（roster），
通过可插拔的 AI 服务自动分配员工到班次，人工复核调整后，导出为 ICS/Excel/PDF，或直接邮件发送
给员工。员工本身不是系统用户，不登录，只作为数据记录存在，通过邮件接收自己的排班表。

数据归属模型：单用户 = 独立"店铺"，账户之间数据完全隔离，不支持多管理员共享同一份数据。

## 2. 技术栈

| 层 | 选型 |
|---|---|
| 前端 | Vite + React + TypeScript + Tailwind CSS，SPA |
| 后端 | Express + TypeScript，REST API |
| ORM | Prisma |
| 数据库 | 标准 Postgres，通过 `DATABASE_URL` 环境变量连接（供应商未定，Neon / Render Postgres / Supabase / 自建均可，换库商只改环境变量，代码不变） |
| 认证 | Passport.js（Google OAuth 2.0 strategy + local email/password strategy），JWT 存 httpOnly cookie |
| AI 分配 | 可插拔 Provider 适配层，见第 6 节 |
| 邮件 | Resend（发送员工排班表 + 密码重置邮件） |
| 部署 | 前端：Render Static Site；后端：Render Web Service；两者统一在 Render 管理 |

## 3. 数据模型

Prisma schema 层面的实体（非最终 DDL）：

```
User
  id, email, passwordHash (nullable, Google-only用户为空), googleId (nullable)
  createdAt

Staff                     — 属于某个 User
  id, userId, name, email, skills: string[]

Preference                — 属于某个 Staff，一对一或一对多（按类型拆分字段即可，一对一足够）
  id, staffId
  preferredShiftTemplateIds: string[]   // 偏好班次时段
  unavailableDates: DateRange[]          // 不可用日期/请假
  minHoursPerWeek: number
  maxHoursPerWeek: number
  preferredWeekdays: number[]            // 0-6，偏好上班的星期几

StaffGroup                — 属于某个 User，用户自定义小组
  id, userId, name

GroupMember                — StaffGroup <-> Staff 多对多中间表
  groupId, staffId

ShiftTemplate              — 属于某个 User，可复用
  id, userId, name, startTime, endTime   // 固定时间段，不含人数/技能

Roster                     — 一次排班
  id, userId, name, dateRangeStart, dateRangeEnd, groupId, status (draft/published)

RosterShift                — Roster 中某天套用某个 ShiftTemplate 的实例
  id, rosterId, shiftTemplateId, date, headcount, requiredSkills: string[]

Assignment                 — RosterShift 与 Staff 的分配关系
  id, rosterShiftId, staffId (nullable), unfilledTag (nullable: "AGENT" | "PICKUP" | 自定义文本)

PasswordResetToken
  id, userId, tokenHash, expiresAt
```

关键说明：
- `ShiftTemplate` 只固定时间段；人数（headcount）和技能要求（requiredSkills）在套用到具体
  `Roster`（即生成 `RosterShift`）时才指定。
- `Assignment` 是排班结果最小单元：一行代表某天某班次某个坑位分配给了谁，或未分配 + 标签。
- `Staff.email` 只用于发送邮件，Staff 不是系统登录用户。

## 4. 认证

- Google OAuth 一键登录，或邮箱 + 密码注册（bcrypt 哈希，密码最短长度要求即可，无需复杂度校验）
- 登录成功签发 JWT，存 httpOnly cookie，后续请求靠 cookie 鉴权
- **密码重置**：登录页"忘记密码"入口 → 输入邮箱 → 后端生成一次性 token（数据库存哈希，20 分钟
  有效）→ Resend 发送含重置链接邮件（`https://<frontend>/reset-password?token=xxx`）→ 用户输入
  新密码 → 校验 token 有效且未过期 → 更新密码哈希、token 立即失效。仅对邮箱+密码账户生效，
  Google 登录用户没有本地密码，不适用此流程。

## 5. 核心工作流

### 5.1 员工与小组管理
- Staff CRUD：姓名、邮箱、技能标签、preferences（见数据模型）
- StaffGroup CRUD：创建/重命名/删除小组，随时增删组内成员（多对多）

### 5.2 班次模板管理
- ShiftTemplate CRUD：名称 + 开始/结束时间，可在不同 Roster 中复用

### 5.3 创建 Roster
1. 选日期范围
2. 选一个 StaffGroup 作为本次排班的员工池
3. 选择要用哪些 ShiftTemplate，并逐个指定：哪些日期套用、每天所需人数（headcount）、
   所需技能标签（requiredSkills）
4. 保存后生成 Roster（status = draft）及对应的 RosterShift 记录

### 5.4 AI 自动分配
- 用户点击"生成排班" → 后端组装该 Roster 全部 RosterShift + 该 Group 内所有 Staff 的
  preferences/技能/工时要求，作为上下文调用 AI Provider（见第 6 节）
- 分配优先级：**先保证每位员工的最低工时（minHoursPerWeek）→ 再满足个人 preference
  （偏好时段/星期几/不可用日期）→ 再做技能匹配（requiredSkills）**
- AI 返回结构化分配结果（JSON：RosterShift → Staff[] 列表），后端解析写入 Assignment 表
- 某个 RosterShift 分配不满 headcount 时，对应坑位的 Assignment 记录 staffId 为空，
  等待用户在复核阶段处理
- AI 调用失败或返回不合法结果：整批分配标记失败，前端提示用户重试或转为纯手动排班，
  不做自动重试、不回退到规则算法

### 5.5 人工复核与调整
- Roster 详情页用表格/日历视图展示所有 Assignment
- 可操作：换人（改某坑位的 Staff）、清空某坑位、给未分配坑位打标签
  （预置 "AGENT" 外部/临时工、"PICKUP" 加班招募，或自定义文本）
- **保存机制**：所有调整先停留在前端本地状态，页面提供显式"保存"按钮；点击保存前的改动
  不写入数据库。点击保存后一次性提交所有改动到后端。未保存离开页面时需弹窗确认。
- 不做版本历史/回滚，保存即覆盖当前草稿。

### 5.6 发布、导出、发送
- 用户确认无误后点击"发布"（Roster.status → published；发布后仍可编辑，发布只是给
  "正式版"打一个状态/时间戳标记，不锁定编辑）
- 导出：整份 Roster 可导出为 ICS / Excel / PDF；支持两种粒度——按单个 Staff 导出个人时间表，
  或按整组导出总表
- 邮件发送：可选择"发送给全体/单个员工"，后端用 Resend 给每个 Staff 邮箱发送其个人时间表
  （邮件正文列出班次明细，附件带该员工的 ICS 文件）

## 6. AI Provider 可插拔设计

后端内建统一接口：

```ts
interface AIProvider {
  assignShifts(context: AssignmentContext): Promise<AssignmentResult>;
}
```

具体实现按 **OpenAI 兼容的 Chat Completions 接口格式** 发起 HTTP 请求——该格式被 OpenAI、
OpenRouter、Anthropic 兼容端点、以及主流自建/本地模型服务（Ollama、vLLM 等）广泛支持。
所有可配置项走环境变量，切换供应商无需改代码：

```
AI_BASE_URL=https://api.anthropic.com/v1   // 或 openai.com / openrouter.ai / 自建地址
AI_API_KEY=xxx
AI_MODEL=claude-sonnet-5                    // 或 gpt-4o / 任意模型名
```

若未来切换的供应商 API 格式与 OpenAI 兼容格式差异较大，只需改这一个适配层文件
（不会波及路由、数据模型等其他业务代码）。

## 7. 移动端适配

核心工作流（查看/编辑排班、员工与小组管理、发布与导出）需要在手机浏览器上顺畅可用：
Tailwind 响应式布局系统性覆盖主要页面（表格在小屏幕转卡片式布局或提供横向滚动容器、
触控友好的按钮尺寸与点击区域），不是简单"能看"，而是操作流程要顺手。

## 8. MVP 范围边界（明确不做的部分）

- 员工无登录入口，不做员工端权限系统
- 不支持多管理员共享同一份数据（每个 User 账户数据独立隔离）
- 不做班次冲突的复杂法规校验（如强制最短休息间隔），只按 preferences 中已定义的四类
  字段（偏好时段/不可用日期/最小-最大工时/偏好星期几）做软约束
- AI 分配失败时不自动重试、不回退到规则算法
- 不做 Roster 版本历史/回滚

## 9. 部署

- 前端：Render Static Site（Vite build 产物）
- 后端：Render Web Service（Express server）
- 数据库：Postgres，供应商待定，`DATABASE_URL` 环境变量注入
- 邮件：Resend API Key 环境变量注入
- AI：`AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL` 环境变量注入，供应商可随时切换
