import type { CSSProperties } from 'react';
import { cx } from './cx';

/** Illustrations in /public/art (from the Figma file; placeholders until the sprite kit, D1). */
export type ArtName =
  | 'austin' | 'brooklyn' | 'boise' | 'tampa' | 'queens' | 'columbus'
  | 'future' | 'upload' | 'afford' | 'loan' | 'checkin';

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
        className={cx('block h-auto w-full rounded-lg bg-surface-strong object-cover', imgClassName)}
      />
    </div>
  );
}
