import type { CSSProperties } from 'react';

const LEAVES = [
  { left: '4%', size: 20, delay: '0s', duration: '15s', tone: 'text-eucalyptus/40' },
  { left: '16%', size: 15, delay: '4s', duration: '13s', tone: 'text-tan/40' },
  { left: '34%', size: 19, delay: '8s', duration: '18s', tone: 'text-eucalyptus-dark/30' },
  { left: '52%', size: 13, delay: '2s', duration: '14s', tone: 'text-tan/35' },
  { left: '70%', size: 22, delay: '10s', duration: '19s', tone: 'text-eucalyptus/35' },
  { left: '86%', size: 16, delay: '6s', duration: '16s', tone: 'text-tan/30' },
];

function GumLeaf({ className, style }: { className: string; style: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style}>
      <path d="M12 1.5c6.5 3.4 9.5 8.6 9.5 13.4a9.5 9.5 0 0 1-19 0c0-4.8 3-10 9.5-13.4Z" />
      <path d="M12 4.5v16" stroke="#3A2B22" strokeWidth="0.5" strokeLinecap="round" opacity="0.35" />
    </svg>
  );
}

/**
 * Fixed, non-interactive backdrop layer: slow outback-toned light drifting
 * behind the app, and a handful of gum leaves gently falling. Purely
 * atmospheric — respects prefers-reduced-motion via motion-safe:.
 */
export function AmbientBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="motion-safe:animate-blob-drift absolute -left-24 -top-32 h-[26rem] w-[26rem] rounded-full bg-coral/15 blur-3xl" />
      <div
        className="motion-safe:animate-blob-drift-slow absolute -right-32 top-1/4 h-[30rem] w-[30rem] rounded-full bg-eucalyptus/15 blur-3xl"
        style={{ animationDelay: '2s' }}
      />
      <div
        className="motion-safe:animate-blob-drift absolute -bottom-40 left-1/3 h-[24rem] w-[24rem] rounded-full bg-tan/15 blur-3xl"
        style={{ animationDelay: '6s' }}
      />

      {LEAVES.map((leaf, i) => (
        <GumLeaf
          key={i}
          className={`motion-safe:animate-leaf-fall absolute top-0 ${leaf.tone}`}
          style={{
            left: leaf.left,
            width: leaf.size,
            height: leaf.size,
            animationDelay: leaf.delay,
            animationDuration: leaf.duration,
          }}
        />
      ))}
    </div>
  );
}
