import type { CSSProperties, ReactNode } from 'react';
import { cx } from './cx';

export type StickerTone = 'primary' | 'ink' | 'positive' | 'soft';

const TONE: Record<StickerTone, string> = {
  primary: 'bg-primary text-on-primary',
  ink: 'bg-ink text-on-primary',
  positive: 'bg-positive text-on-primary',
  soft: 'bg-primary-soft text-primary',
};

export type StickerProps = {
  children: ReactNode;
  tone?: StickerTone;
  /** Tilt in degrees, like the stickers in the Figma screens (e.g. -6 or 8). Decorative only. */
  tilt?: number;
  className?: string;
};

/** A small pill label ("STEP 2 OF 5", "THAT'S ME", "+620 POINTS"). Uppercase, bold, optionally tilted. */
export function Sticker({ children, tone = 'primary', tilt = 0, className }: StickerProps) {
  const style: CSSProperties | undefined = tilt ? { transform: `rotate(${tilt}deg)` } : undefined;
  return (
    <span
      style={style}
      className={cx(
        'inline-flex w-fit items-center gap-xs rounded-full px-md py-xs text-xs font-bold uppercase tracking-wide',
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
