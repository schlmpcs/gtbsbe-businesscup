// Classes for the orange paywall band (S15). Kept here because ui/ may not import another feature's ui.

/**
 * Paints the band's background out to both screen edges without widening the page: border-image
 * outset is ink overflow, so it never adds sideways scroll.
 */
export const FULL_BLEED_PRIMARY = 'bg-primary [border-image:conic-gradient(var(--color-primary)_0_0)_fill_0//0_100vmax]';

/** On orange: every text color class inside switches to white (same rule as Card tone="arena"). */
export const ON_ARENA =
  'text-on-primary [&_.text-text]:text-on-primary [&_.text-text-muted]:text-on-primary/80 [&_.text-negative]:text-on-primary';

/** Decorative tilt (degrees), like the Figma tiles. */
export function tilt(deg: number) {
  return { transform: `rotate(${deg}deg)` } as const;
}
