import type { CSSProperties } from 'react';
import { cx } from './cx';

/** Illustrations in /public/art (from the Figma file; placeholders until the sprite kit, D1). */
export type ArtName =
  | 'austin' | 'brooklyn' | 'boise' | 'tampa' | 'queens' | 'columbus'
  | 'future' | 'upload' | 'afford' | 'loan' | 'checkin'
  // Design v3 (Figma page "Design v3 · concept look"): transparent 3D cutouts that sit on the page background.
  | CutoutName;

export type CutoutName =
  | 'duel-houses' | 'step-duels' | 'step-month' | 'step-future'
  | 'house-build' | 'house-crane' | 'house-blueprint' | 'empty-plot'
  | 'little-things' | 'afford-crane' | 'calendar' | 'coins' | 'coffee' | 'streaming'
  | 'home-apartment' | 'home-family' | 'home-suburb' | 'home-large';

const CUTOUTS: ReadonlySet<string> = new Set<CutoutName>([
  'duel-houses', 'step-duels', 'step-month', 'step-future',
  'house-build', 'house-crane', 'house-blueprint', 'empty-plot',
  'little-things', 'afford-crane', 'calendar', 'coins', 'coffee', 'streaming',
  'home-apartment', 'home-family', 'home-suburb', 'home-large',
]);

export type ArtProps = {
  name: ArtName;
  /** Empty string for purely decorative art (the default). */
  alt?: string;
  /** White rounded frame with a soft shadow, as in the Figma tiles. */
  framed?: boolean;
  /** Tilt in degrees (decorative). */
  tilt?: number;
  className?: string;
  imgClassName?: string;
};

/** An illustration. Decorative by default: it never carries a number or a cost fact. */
export function Art({ name, alt = '', framed = false, tilt = 0, className, imgClassName }: ArtProps) {
  const style: CSSProperties | undefined = tilt ? { transform: `rotate(${tilt}deg)` } : undefined;
  return (
    <div style={style} className={cx(framed && 'rounded-xl bg-surface p-md shadow-md', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static local art, no optimizer needed */}
      <img
        src={`/art/${name}.webp`}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={cx(
          'block h-auto w-full',
          CUTOUTS.has(name) ? 'object-contain' : 'rounded-lg bg-surface-strong object-cover',
          imgClassName,
        )}
      />
    </div>
  );
}
