import { ReactNode } from 'react';
import { AmbientBackground } from './AmbientBackground';
import { KangarooMascot } from './KangarooMascot';

interface AuthLayoutProps {
  headline: string;
  tagline: string;
  formEyebrow: string;
  formTitle: string;
  children: ReactNode;
}

export function AuthLayout({ headline, tagline, formEyebrow, formTitle, children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-sand">
      <AmbientBackground />

      {/* brand / mascot panel */}
      <div className="relative overflow-hidden bg-gradient-to-b from-dusk-dark via-dusk to-coral-deep px-6 py-12 lg:w-1/2 lg:py-0 flex flex-col items-center justify-center text-center">
        <div className="motion-safe:animate-blob-drift pointer-events-none absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-coral-light/25 blur-3xl" />
        <div
          className="motion-safe:animate-blob-drift-slow pointer-events-none absolute bottom-0 right-0 h-56 w-56 rounded-full bg-eucalyptus/20 blur-3xl"
          style={{ animationDelay: '3s' }}
        />

        <span className="relative mb-6 inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-1.5 font-display text-xs font-medium uppercase tracking-[0.2em] text-sand/90">
          Roster Creator
        </span>

        <div className="relative motion-safe:animate-hop-in">
          <div className="motion-safe:animate-bob">
            <KangarooMascot variant="hero" className="h-56 w-56 md:h-72 md:w-72 drop-shadow-2xl" />
          </div>
        </div>

        <h2 className="relative mt-6 max-w-sm text-2xl font-bold leading-snug text-white md:text-3xl">{headline}</h2>
        <p className="relative mt-3 max-w-xs text-sm text-sand/75 md:text-base">{tagline}</p>
      </div>

      {/* form panel */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm motion-safe:animate-rise-in" style={{ animationDelay: '150ms' }}>
          <p className="text-sm font-medium text-ink-soft">{formEyebrow}</p>
          <h1 className="mt-1 font-display text-3xl font-semibold text-ink">{formTitle}</h1>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
