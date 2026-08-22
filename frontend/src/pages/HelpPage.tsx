import { Link } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { KangarooMascot } from '../components/KangarooMascot';
import { PageHeader } from '../components/PageHeader';
import { useLanguage } from '../i18n/LanguageContext';
import { btnGhost, cardBase } from '../styles/ui';

interface Step {
  title: string;
  description: string;
  to?: string;
  linkLabel?: string;
}

interface Feature {
  title: string;
  points: string[];
}

interface Faq {
  q: string;
  a: string;
}

interface HelpContent {
  pageTitle: string;
  pageDescription: string;
  quickStartHeading: string;
  featuresHeading: string;
  faqHeading: string;
  steps: Step[];
  features: Feature[];
  faqs: Faq[];
}

const CONTENT: Record<'en' | 'zh', HelpContent> = {
  en: {
    pageTitle: 'Help Guide',
    pageDescription: 'From adding staff to publishing a roster — follow the steps below to get up to speed',
    quickStartHeading: 'Quick Start',
    featuresHeading: 'Feature Details',
    faqHeading: 'FAQ',
    steps: [
      {
        title: 'Set up responsibility templates',
        description:
          'Define the responsibilities staff might take on, like "Cashier" or "Cleaning" — every staff member needs at least one when they’re added.',
        to: '/responsibilities',
        linkLabel: 'Go to Responsibility Templates',
      },
      {
        title: 'Set up shift templates',
        description:
          'Define shifts like "Morning 09:00-17:00" or "Night 22:00-06:00" once, then reuse them when creating rosters or setting staff preferences.',
        to: '/shift-templates',
        linkLabel: 'Go to Shift Templates',
      },
      {
        title: 'Build a group',
        description: 'Put staff who’ll be rostered together into the same group — you’ll pick a group when creating a roster.',
        to: '/groups',
        linkLabel: 'Go to Groups',
      },
      {
        title: 'Add staff',
        description:
          'Record name, email, and at least one responsibility. Hour limits and preferred shifts can be filled in later.',
        to: '/staff',
        linkLabel: 'Go to Staff',
      },
      {
        title: 'Create a roster',
        description: 'Pick a date range and group, then click into each day to set which shifts are needed and how many people for each.',
        to: '/rosters/new',
        linkLabel: 'Create Roster',
      },
      {
        title: 'Auto-assign with AI, then fine-tune',
        description:
          'Open the roster detail page and click "Generate Roster" — AI assigns staff based on their hours and preferences. Not happy with the result? Change it directly in the dropdowns.',
        to: '/rosters',
        linkLabel: 'View Rosters',
      },
      {
        title: 'Publish and notify',
        description:
          'Once it looks right, click "Publish", then "Email Everyone" — or "Email Them" for individual staff. You can also export ICS / Excel / PDF.',
      },
    ],
    features: [
      {
        title: 'Responsibility Templates',
        points: [
          'Define the responsibilities staff might take on, like "Cashier" or "Cleaning"',
          'Selected from here when adding staff — at least one is required',
          'Edit the name or delete it anytime',
        ],
      },
      {
        title: 'Staff',
        points: [
          'Name and email are required; at least one responsibility is required (set these up under Responsibility Templates first)',
          'Scheduling preferences are optional: min/max weekly hours, preferred days, preferred shifts (pick from your shift templates, e.g. morning/night)',
          'Edit or remove any staff member at any time',
        ],
      },
      {
        title: 'Groups',
        points: [
          'Sort staff into groups — a staff member can belong to more than one group',
          'Pick a group when creating a roster and its members appear in the assignment dropdowns',
          'Rename or delete groups anytime',
        ],
      },
      {
        title: 'Shift Templates',
        points: [
          'Define a start and end time once, e.g. "Morning 09:00-17:00"',
          'Select directly from these when creating rosters or setting staff shift preferences',
          'Make sure no roster is still using a template before deleting it',
        ],
      },
      {
        title: 'Rosters',
        points: [
          'When creating one, pick a date range and group, then click into each day to add the shifts and headcounts needed',
          '"Generate Roster" uses AI to auto-assign — you can also pick or reassign manually from the dropdowns',
          'Tag still-open shifts as AGENT / PICKUP or a custom label to track follow-up',
          'Once published, email staff or export ICS / Excel / PDF',
        ],
      },
      {
        title: 'Dashboard',
        points: [
          'Shows shortcut cards with live counts for staff, groups, shift templates, and rosters',
          'Click any card to jump straight into that section',
        ],
      },
    ],
    faqs: [
      {
        q: 'Not happy with what the AI assigned?',
        a: 'Change it directly in that shift’s dropdown, then remember to click "Save".',
      },
      {
        q: 'How do I flag a shift that’s still unfilled?',
        a: 'Leave the staff field empty and click AGENT, PICKUP, or type a custom label so you or a colleague knows it still needs someone.',
      },
      {
        q: 'Can I still make changes after publishing?',
        a: 'Yes — just remember to save again, then re-send the email or re-export the file so staff see the latest version.',
      },
      {
        q: 'What happens to existing rosters if I delete a staff member?',
        a: 'The roster itself isn’t deleted, but that person is removed from every assignment — past and future — and those shifts become unfilled.',
      },
      {
        q: 'Where do I switch between English and Chinese?',
        a: 'Use the language toggle in the sidebar — it applies immediately and is remembered next time you sign in.',
      },
    ],
  },
  zh: {
    pageTitle: '使用指南',
    pageDescription: '从添加员工到发布排班表，跟着下面的步骤走一遍就会用了',
    quickStartHeading: '快速上手',
    featuresHeading: '功能详解',
    faqHeading: '常见问题',
    steps: [
      {
        title: '设置职责模板',
        description: '先定义好员工可能承担的职责，比如"收银""清洁"，添加员工时至少要选一个。',
        to: '/responsibilities',
        linkLabel: '去职责模板',
      },
      {
        title: '设置班次模板',
        description: '定义好"早班 09:00-17:00""夜班 22:00-06:00"这类班次，之后创建排班和员工填偏好时都直接选用。',
        to: '/shift-templates',
        linkLabel: '去班次模板',
      },
      {
        title: '建立小组',
        description: '把要一起排班的员工分到同一个小组，创建排班表时按组选人。',
        to: '/groups',
        linkLabel: '去小组管理',
      },
      {
        title: '添加员工',
        description: '记录姓名、邮箱，并至少勾选一个职责；工时上下限、偏好班次都可以之后再补。',
        to: '/staff',
        linkLabel: '去员工管理',
      },
      {
        title: '创建排班表',
        description: '选好日期范围和小组，再点开每一天，配置需要哪些班次、各需要几人。',
        to: '/rosters/new',
        linkLabel: '创建排班',
      },
      {
        title: 'AI 自动分配，再手动微调',
        description: '打开排班表详情页，点"生成排班"，AI 会参考每位员工的工时和偏好自动安排；结果不满意可以直接在下拉框里改。',
        to: '/rosters',
        linkLabel: '查看排班表',
      },
      {
        title: '发布并通知',
        description: '确认无误后点"发布"，再"发送邮件给全体"，或对个别人"发送给TA"；也可以导出 ICS / Excel / PDF。',
      },
    ],
    features: [
      {
        title: '职责模板',
        points: ['定义员工可能承担的职责，比如"收银""清洁"', '添加员工时从这里挑选，至少要选一个', '随时可以编辑名称或删除'],
      },
      {
        title: '员工管理',
        points: [
          '姓名、邮箱必填，职责至少要选一个（在"职责模板"里先建好）',
          '排班偏好可选：最小/最大周工时、偏好星期几、偏好班次（勾选已建好的班次模板，比如早班/夜班）',
          '每位员工都可以随时编辑资料或删除',
        ],
      },
      {
        title: '小组管理',
        points: ['把员工分到不同小组，一个员工可以属于多个组', '创建排班表时选一个组，组内成员会出现在分配下拉框里', '随时可以重命名或删除小组'],
      },
      {
        title: '班次模板',
        points: ['一次定义好上下班时间，比如"早班 09:00-17:00"', '创建排班、员工填偏好班次时都直接从模板里选', '删除前确认没有排班表还在使用这个模板'],
      },
      {
        title: '排班表',
        points: [
          '创建时选日期范围、小组，再点开每一天，添加需要的班次和人数',
          '"生成排班"用 AI 自动分配；也可以在下拉框里手动指定或改派',
          '还没定的班次可以标 AGENT / PICKUP 或自定义标签，方便后续跟进',
          '发布后可以发邮件通知，或导出 ICS / Excel / PDF',
        ],
      },
      {
        title: '仪表盘',
        points: ['以卡片形式实时展示员工、小组、班次模板、排班表的数量', '点击任意卡片可直接跳转到对应页面'],
      },
    ],
    faqs: [
      {
        q: 'AI 分配的结果不满意怎么办？',
        a: '直接在对应班次的下拉框里改成想要的人，改完记得点"保存"。',
      },
      {
        q: '有的班次暂时没人，怎么标记？',
        a: '把员工留空，点 AGENT、PICKUP 或输入自定义标签，方便自己或同事知道这里还缺人。',
      },
      {
        q: '发布之后还能改吗？',
        a: '可以，改完记得再保存一次，之后重新发送邮件或导出文件，员工才会看到最新版本。',
      },
      {
        q: '删除员工后，之前的排班表会怎样？',
        a: '排班表本身不会被删除，但这个人会从所有排班（包括已发布的历史排班）中移除，对应的班次会变成未分配状态。',
      },
      {
        q: '在哪里切换中英文？',
        a: '在侧边栏点击语言切换按钮即可，会立即生效，下次登录也会记住你的选择。',
      },
    ],
  },
};

export function HelpPage() {
  const { language } = useLanguage();
  const content = CONTENT[language];

  return (
    <AppShell>
      <div className="space-y-10">
        <PageHeader
          title={content.pageTitle}
          description={content.pageDescription}
          action={<KangarooMascot variant="badge" animated={false} className="h-14 w-14" />}
        />

        <nav className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <a href="#quick-start" className="text-ink-soft underline-offset-4 hover:text-coral-deep hover:underline">
            {content.quickStartHeading}
          </a>
          <a href="#feature-details" className="text-ink-soft underline-offset-4 hover:text-coral-deep hover:underline">
            {content.featuresHeading}
          </a>
          <a href="#faq" className="text-ink-soft underline-offset-4 hover:text-coral-deep hover:underline">
            {content.faqHeading}
          </a>
        </nav>

        <section id="quick-start" className="scroll-mt-6 space-y-5">
          <h2 className="font-display text-lg font-semibold text-ink">{content.quickStartHeading}</h2>
          <ol className="space-y-5">
            {content.steps.map((step, i) => (
              <li key={step.title} className="flex gap-5">
                <div className="flex flex-col items-center">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-coral-deep/10 font-display text-sm font-semibold text-coral-deep">
                    {i + 1}
                  </span>
                  {i < content.steps.length - 1 && <span className="mt-1 w-px flex-1 bg-tan/20" />}
                </div>
                <div className={`${cardBase} flex-1 sm:flex sm:items-center sm:justify-between sm:gap-4`}>
                  <div>
                    <p className="font-medium text-ink">{step.title}</p>
                    <p className="mt-1 text-sm text-ink-soft">{step.description}</p>
                  </div>
                  {step.to && (
                    <Link to={step.to} className={`${btnGhost} mt-3 shrink-0 sm:mt-0`}>
                      {step.linkLabel} →
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section id="feature-details" className="scroll-mt-6 space-y-5">
          <h2 className="font-display text-lg font-semibold text-ink">{content.featuresHeading}</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {content.features.map((f) => (
              <div key={f.title} className={cardBase}>
                <h3 className="font-display text-base font-semibold text-ink">{f.title}</h3>
                <ul className="mt-3 space-y-2">
                  {f.points.map((p) => (
                    <li key={p} className="flex gap-2 text-sm text-ink-soft">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-eucalyptus" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section id="faq" className="scroll-mt-6 space-y-5">
          <h2 className="font-display text-lg font-semibold text-ink">{content.faqHeading}</h2>
          <div className="space-y-3">
            {content.faqs.map((item) => (
              <div key={item.q} className={cardBase}>
                <p className="font-medium text-ink">{item.q}</p>
                <p className="mt-1.5 text-sm text-ink-soft">{item.a}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
