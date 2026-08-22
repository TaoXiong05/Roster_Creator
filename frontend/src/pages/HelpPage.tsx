import { Link } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { KangarooMascot } from '../components/KangarooMascot';
import { PageHeader } from '../components/PageHeader';
import { getDictionary, useLanguage } from '../i18n/LanguageContext';
import { btnGhost, cardBase } from '../styles/ui';

export function HelpPage() {
  const { language } = useLanguage();
  const content = getDictionary(language).help;

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
                  {'to' in step && step.to && (
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
