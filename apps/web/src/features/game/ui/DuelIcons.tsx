import type { ReactNode } from 'react';

// Small line icons for the duel (Figma Design v3: fact chips, the hint chip, the "what decided it" bulb).
// Decorative only: every icon sits next to text that carries the meaning.

export type DuelIconName = 'car' | 'food' | 'people' | 'home' | 'pin' | 'bulb' | 'arrow';

const PATHS: Record<DuelIconName, ReactNode> = {
  car: (
    <>
      <path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11" />
      <path d="M3 11h18v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
      <path d="M6 17v2M18 17v2" />
      <circle cx="7.5" cy="14" r="0.5" />
      <circle cx="16.5" cy="14" r="0.5" />
    </>
  ),
  food: (
    <>
      <path d="M6 3v7a2 2 0 0 0 4 0V3M8 3v18" />
      <path d="M17 21V3c-2 1.5-3 4-3 7v3h3" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M16 5.5a3 3 0 0 1 0 5.5M18 14.5c1.8.9 3 2.9 3 5.5" />
    </>
  ),
  home: (
    <>
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  bulb: (
    <>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />
    </>
  ),
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
};

export function DuelIcon({ name, className }: { name: DuelIconName; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? 'size-lg shrink-0'}
    >
      {PATHS[name]}
    </svg>
  );
}
