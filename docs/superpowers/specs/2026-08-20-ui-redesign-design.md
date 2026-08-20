# Roster Creator — UI 重构设计文档

**日期：** 2026-08-20
**状态：** 待用户确认，确认后转入实施计划

## 1. 背景与目标

`roster-redesign.design/` 目录下有一套用 AI 设计工具生成的静态 HTML 预览稿（登录、数据看板、
排班表、员工列表、新建员工-分步向导，共 5 个页面），用来探索新的 UI 方向。目标是把预览稿里
**值得借鉴的布局结构、组件样式、排版节奏**应用到现有项目的全部 16 个前端页面上，同时：

- 不改动任何现有功能、路由、API 调用、表单字段、业务逻辑
- 保留现有配色体系（coral/tan/sand/eucalyptus/ink，见 [tailwind.config.js](../../../frontend/tailwind.config.js)）
  和字体（`Fredoka` 标题 + `Noto Sans SC` 正文），完全不采用预览稿的靛蓝色系和 Inter/Sora 字体
- 保留袋鼠吉祥物（`KangarooMascot`）、现有 i18n 系统、DD/MM/YYYY 日期格式、TimeInput 时钟选择器
- 不确定的地方已经和用户逐项确认过（见第 3 节）

## 2. 现状盘点

**当前调色板**（`frontend/tailwind.config.js`）：`coral`（主色）、`tan`/`sand`（中性暖色）、
`eucalyptus`（成功/绿色）、`dusk`（辅助色）、`ink`（文字）。圆角已经比较大
（`rounded-2xl`/`rounded-[24px]`），有 `shadow-warm` 系列阴影，已有 `hop-in`/`rise-in`/`bob` 等
动效。

**当前共享结构**：`AppShell.tsx` 已经是"桌面侧边栏 + 移动端顶栏/抽屉"结构，`styles/ui.ts` 里有
一套按钮/输入框/卡片/表格行的样式常量，各页面统一引用。也就是说预览稿的"侧边栏 + 内容区"骨架
和现有结构本质相同，重构的重点是**视觉细节打磨**（间距节奏、卡片层级、表格观感、页头/顶栏一致
性），而不是推倒重建导航结构。

**预览稿只覆盖 5 个页面**，且部分页面包含现有系统没有的内容（详见第 3 节的处理原则）。

## 3. 已确认的关键决策

| 问题 | 决策 |
|---|---|
| 配色 | 只借用预览稿的布局/结构/间距/组件形态，颜色全部换回现有 coral/tan/sand/eucalyptus/ink 体系，字体不变 |
| 页面覆盖范围 | 从 5 个预览页面提炼出一套可复用的设计模式，应用到全部 16 个页面，而不只是有预览稿的那几个 |
| 预览稿里"多出来的"内容（新建员工分步向导的额外字段：身份证号/性别/出生日期/民族/社保号/地址/部门/职级/入职日期/紧急联系人；排班表的周/月视图切换和悬停换班） | 新建员工页**保留分步向导这种交互形式**，但只把现有字段（姓名/邮箱/职责 → 第一步，偏好设置 → 第二步）分配进去，不新增任何字段；排班表页不加周/月切换、不加换班交互 |

**延伸原则**（据此推广到其他页面，实施时逐页面应用）：预览稿里出现但当前系统没有对应数据/
功能支撑的内容一律不做，包括但不限于：
- 数据看板的搜索框（⌘K）、通知铃铛、消息图标、"考勤打卡"/"团队日历"/"设置"导航项、
  用户下拉菜单——现有系统没有这些功能
- 数据看板 KPI 卡片里的"较上周 12%"这类趋势数字——现有系统不采集这些指标，不能编造数据
- 员工列表的复选框批量操作、手机号列、职级徽章、入职日期列、在职状态徽章——现有 `Staff` 只有
  `name`/`email`/`responsibilityIds`/`preference`，没有这些字段

这条原则的落地方式：**只挪用视觉形态（卡片/表格/徽章/按钮的样式与间距），不挪用视觉形态背后
暗示的字段或功能**。每个页面在实施时如果遇到新的、本文档未列出的"多余内容"，按同一原则处理
（不加），不需要再单独询问用户。

## 4. 设计 Token 映射

从预览稿的 `colors_and_type.css` 提炼出的结构性 token（间距/圆角/阴影分级思路），映射到现有
Tailwind 配置：

| 预览稿概念 | 现有项目对应 |
|---|---|
| `--rc-radius-md/lg/xl`（14/20/28px 阶梯） | 沿用现有 `rounded-xl`/`rounded-2xl`/`rounded-[24px]` 阶梯，不新增数值 |
| `--rc-shadow-sm/md/lg`（阴影分级） | 沿用现有 `shadow-warm-sm`/`shadow-warm`，按预览稿的"卡片默认用 sm，hover 用 md"这类分级规则重新分配现有阴影，不新增阴影颜色 |
| 侧边栏宽度 `264px` / 顶栏高度 `72px` | 现有侧边栏已是 `w-64`（256px），基本一致，不改 |
| KPI 卡片 / stat card 形态 | 新增一个共享 `StatCard` 组件（纯样式，数据来自现有已获取的真实计数，不编造趋势值），用于 Dashboard |
| 表格 header 大写字母间距、行 hover、圆角卡片包裹表格 | 沿用现有 `listRow`/表格样式，按预览稿间距节奏微调 `styles/ui.ts` |
| 顶栏（面包屑 + 页面标题 + 右侧操作区） | 抽取一个轻量 `PageHeader` 顶栏样式统一到所有页面（现有 `PageHeader.tsx` 已存在，做样式打磨而非重写结构） |

**不引入**：预览稿的 Indigo 色值、Inter/Sora 字体、`avatar-btn` 渐变头像的靛蓝配色（如果要做
用户头像圆点，用现有 coral 系配色）。

## 5. 共享组件改动

1. `frontend/src/styles/ui.ts` — 打磨按钮/输入框/卡片/表格行的间距、字重、hover 过渡，颜色值不
   变，只调整间距和阴影分级的使用方式。
2. `frontend/src/components/AppShell.tsx` — 侧边栏和顶栏视觉细节打磨（导航项间距、图标对齐、
   移动端顶栏布局），导航项本身（现有的 5 个入口：职责/员工/小组/班次模版/排班 + 帮助）不变，
   不新增预览稿里那些不存在的导航项。
3. `frontend/src/components/PageHeader.tsx` — 统一各页面标题区的排版层级。
4. 新增 `frontend/src/components/StatCard.tsx` — 仅用于 Dashboard 的 4 个入口卡片，展示真实数据
   （如员工数/小组数，取自已有 API），样式参考预览稿 KPI 卡片但配色换回 coral/tan/eucalyptus/
   dusk（现有 Dashboard 卡片已经用了这套色，本次是精修卡片内部排版）。
5. 其余现有组件（`ConfirmDialog`/`EmptyState`/`Skeleton`/`StatusPill`/`TimeInput`/
   `UnavailableDatesDialog`/`DayShiftDialog`/`PreferenceFields`）保留组件接口不变，仅做内部样式
   打磨。

## 6. 分批实施顺序

按照"共享基础 → 认证页 → 核心业务页"的顺序分批，每批完成后跑一次前端测试套件（86 个用例）
和 `tsc --noEmit`，并在浏览器里实际过一遍再进入下一批：

1. **基础层**：`styles/ui.ts`、`AppShell.tsx`、`PageHeader.tsx`、新增 `StatCard.tsx`
2. **认证页**：`LoginPage`、`RegisterPage`、`ForgotPasswordPage`、`ResetPasswordPage`
   （`AuthLayout.tsx` 一并打磨）
3. **Dashboard**：`DashboardPage.tsx`（接入 `StatCard`）
4. **员工**：`StaffListPage`、`StaffCreatePage`（改为两步向导，字段不变）、`StaffEditPage`
5. **小组**：`GroupListPage`、`GroupDetailPage`
6. **模版**：`ShiftTemplateListPage`、`ResponsibilityListPage`
7. **排班**：`RosterListPage`、`RosterCreatePage`、`RosterDetailPage`（不加周/月切换、不加换班）
8. **帮助页**：`HelpPage`

## 7. 测试与验证

- 现有前端 86 个用例、后端 129 个用例必须保持全绿；两个存在 `toHaveClass` 断言的测试文件
  （`PreferenceFields.test.tsx`、`StaffEditPage.test.tsx`）如果断言的具体 class 名称发生变化，
  同步更新断言，但不改变其测试意图。
- 每一批改完，起本地 dev server 用浏览器实际走一遍该批页面的核心操作路径（不只是看样式），
  确认功能未受影响。
- 不新增、不删除、不重命名任何路由、API 调用、Prisma 字段。

## 8. 明确不做的事（Out of scope）

- 不做深色模式
- 不改动后端、数据库 schema、i18n 文案内容（除非某个 key 因样式重排需要调整容器/间距，文案本身不变）
- 不引入预览稿里的搜索框、通知、消息、考勤打卡、团队日历、设置入口
- 不做排班表的周/月视图切换、悬停换班
- 不给员工模型新增字段（身份证/性别/生日/民族/社保/地址/部门/职级/入职日期/紧急联系人等）
- 不采用预览稿的靛蓝配色和 Inter/Sora 字体
