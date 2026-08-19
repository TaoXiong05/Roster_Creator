import { useId } from 'react';

interface KangarooMascotProps {
  variant?: 'hero' | 'badge';
  className?: string;
  animated?: boolean;
}

/**
 * Roo — the mascot. Soft gradient-shaded "clay" illustration (not literal
 * WebGL 3D) built from layered primitives so the highlight/shadow read as
 * volume. Her pouch carries a little calendar: the product's whole idea in
 * one image.
 */
export function KangarooMascot({ variant = 'hero', className = '', animated = true }: KangarooMascotProps) {
  const uid = useId().replace(/:/g, '');

  const bodyGradId = `${uid}-body`;
  const headGradId = `${uid}-head`;
  const earGradId = `${uid}-ear`;
  const tanGradId = `${uid}-tan`;
  const pouchGradId = `${uid}-pouch`;
  const shadowFilterId = `${uid}-shadow`;

  const gradients = (
    <defs>
      <linearGradient id={bodyGradId} x1="15%" y1="10%" x2="85%" y2="95%">
        <stop offset="0%" stopColor="#F4A97C" />
        <stop offset="55%" stopColor="#E8834F" />
        <stop offset="100%" stopColor="#C9642F" />
      </linearGradient>
      <linearGradient id={headGradId} x1="15%" y1="5%" x2="80%" y2="100%">
        <stop offset="0%" stopColor="#F8C099" />
        <stop offset="60%" stopColor="#EC8E56" />
        <stop offset="100%" stopColor="#D6743A" />
      </linearGradient>
      <linearGradient id={earGradId} x1="20%" y1="0%" x2="80%" y2="100%">
        <stop offset="0%" stopColor="#E3B58C" />
        <stop offset="100%" stopColor="#B67A4E" />
      </linearGradient>
      <linearGradient id={tanGradId} x1="20%" y1="0%" x2="90%" y2="100%">
        <stop offset="0%" stopColor="#D9A276" />
        <stop offset="100%" stopColor="#A9714A" />
      </linearGradient>
      <linearGradient id={pouchGradId} x1="10%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FCE8CE" />
        <stop offset="100%" stopColor="#E3B58C" />
      </linearGradient>
      <filter id={shadowFilterId} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="7" />
      </filter>
    </defs>
  );

  if (variant === 'badge') {
    return (
      <svg
        viewBox="0 0 200 200"
        className={className}
        role="img"
        aria-label="小袋鼠 Roo"
      >
        {gradients}
        <circle cx="100" cy="100" r="98" fill="#FCE8CE" />
        {/* ears */}
        <g className={animated ? 'motion-safe:animate-ear-twitch' : ''} style={{ transformOrigin: '128px 96px' }}>
          <ellipse cx="128" cy="66" rx="20" ry="33" transform="rotate(15 128 66)" fill={`url(#${earGradId})`} />
          <ellipse cx="126" cy="71" rx="11" ry="20" transform="rotate(15 126 71)" fill="#FCE8CE" opacity="0.85" />
        </g>
        <ellipse cx="72" cy="66" rx="20" ry="33" transform="rotate(-15 72 66)" fill={`url(#${earGradId})`} />
        <ellipse cx="74" cy="71" rx="11" ry="20" transform="rotate(-15 74 71)" fill="#FCE8CE" opacity="0.85" />
        {/* head */}
        <circle cx="100" cy="108" r="58" fill={`url(#${headGradId})`} />
        <ellipse cx="80" cy="82" rx="24" ry="16" transform="rotate(-18 80 82)" fill="#ffffff" opacity="0.16" />
        {/* face */}
        <circle cx="82" cy="110" r="6" fill="#3A2B22" />
        <circle cx="118" cy="110" r="6" fill="#3A2B22" />
        <circle cx="79.5" cy="107.5" r="2" fill="#ffffff" opacity="0.9" />
        <circle cx="115.5" cy="107.5" r="2" fill="#ffffff" opacity="0.9" />
        <ellipse cx="100" cy="128" rx="7" ry="5" fill="#5B4B75" />
        <path d="M89 137 Q100 145 111 137" stroke="#3A2B22" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <ellipse cx="70" cy="123" rx="9" ry="5.5" fill="#E8834F" opacity="0.35" />
        <ellipse cx="130" cy="123" rx="9" ry="5.5" fill="#E8834F" opacity="0.35" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 400 440"
      className={className}
      role="img"
      aria-label="小袋鼠 Roo，育儿袋里装着排班表"
    >
      {gradients}
      {/* ground shadow */}
      <ellipse cx="205" cy="415" rx="120" ry="15" fill="#3A2B22" opacity="0.15" filter={`url(#${shadowFilterId})`} />

      {/* tail */}
      <path
        d="M238 258 C 305 268, 348 308, 346 363 C 345 393, 313 404, 289 393 C 300 358, 282 298, 235 278 Z"
        fill={`url(#${tanGradId})`}
      />

      {/* back feet */}
      <ellipse cx="150" cy="400" rx="56" ry="24" transform="rotate(-8 150 400)" fill={`url(#${tanGradId})`} />
      <ellipse cx="248" cy="405" rx="59" ry="25" transform="rotate(6 248 405)" fill={`url(#${tanGradId})`} />

      {/* resting arm (screen-left) */}
      <g>
        <ellipse cx="130" cy="292" rx="22" ry="46" transform="rotate(18 130 292)" fill={`url(#${bodyGradId})`} />
        <circle cx="119" cy="333" r="17" fill="#F4A97C" />
      </g>

      {/* body */}
      <ellipse cx="200" cy="292" rx="97" ry="118" fill={`url(#${bodyGradId})`} />
      <ellipse cx="200" cy="307" rx="63" ry="80" fill="#FCE8CE" />

      {/* pouch pocket */}
      <rect x="150" y="276" width="100" height="76" rx="34" transform="rotate(-3 200 314)" fill={`url(#${pouchGradId})`} />

      {/* calendar peeking from pouch */}
      <g transform="rotate(-7 200 278)">
        <rect x="178" y="255" width="46" height="42" rx="8" fill="#ffffff" />
        <circle cx="189" cy="259" r="3" fill="#5B4B75" />
        <circle cx="213" cy="259" r="3" fill="#5B4B75" />
        <rect x="185" y="270" width="32" height="4" rx="2" fill="#FCE8CE" />
        <rect x="185" y="279" width="32" height="4" rx="2" fill="#E8834F" />
        <rect x="185" y="288" width="20" height="4" rx="2" fill="#FCE8CE" />
      </g>

      {/* neck join */}
      <ellipse cx="200" cy="187" rx="46" ry="26" fill={`url(#${bodyGradId})`} />

      {/* ears */}
      <g>
        <ellipse cx="155" cy="60" rx="26" ry="42" transform="rotate(-18 155 60)" fill={`url(#${earGradId})`} />
        <ellipse cx="158" cy="67" rx="14" ry="27" transform="rotate(-18 158 67)" fill="#FCE8CE" opacity="0.85" />
      </g>
      <g className={animated ? 'motion-safe:animate-ear-twitch' : ''} style={{ transformOrigin: '248px 96px' }}>
        <ellipse cx="248" cy="58" rx="26" ry="42" transform="rotate(16 248 58)" fill={`url(#${earGradId})`} />
        <ellipse cx="245" cy="65" rx="14" ry="27" transform="rotate(16 245 65)" fill="#FCE8CE" opacity="0.85" />
      </g>

      {/* head */}
      <circle cx="200" cy="126" r="73" fill={`url(#${headGradId})`} />
      <ellipse cx="170" cy="90" rx="32" ry="20" transform="rotate(-20 170 90)" fill="#ffffff" opacity="0.16" />

      {/* face */}
      <circle cx="176" cy="126" r="7.5" fill="#3A2B22" />
      <circle cx="215" cy="126" r="7.5" fill="#3A2B22" />
      <circle cx="173" cy="123" r="2.5" fill="#ffffff" opacity="0.9" />
      <circle cx="212" cy="123" r="2.5" fill="#ffffff" opacity="0.9" />
      <ellipse cx="195" cy="150" rx="9" ry="6" fill="#5B4B75" />
      <path d="M182 160 Q195 170 208 160" stroke="#3A2B22" strokeWidth="3" strokeLinecap="round" fill="none" />
      <ellipse cx="163" cy="143" rx="12" ry="7" fill="#E8834F" opacity="0.35" />
      <ellipse cx="237" cy="143" rx="12" ry="7" fill="#E8834F" opacity="0.35" />

      {/* waving arm (screen-right), drawn last so it sits over the head's shoulder line */}
      <g className={animated ? 'motion-safe:animate-wave' : ''} style={{ transformOrigin: '272px 240px' }}>
        <ellipse cx="281" cy="228" rx="20" ry="43" transform="rotate(-28 281 228)" fill={`url(#${bodyGradId})`} />
        <circle cx="299" cy="193" r="16" fill="#F4A97C" />
      </g>
    </svg>
  );
}
