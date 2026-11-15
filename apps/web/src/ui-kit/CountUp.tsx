'use client';

// A number that counts up to its value (presentational motion only: the value comes from a view-model,
// this only animates its display). Screen readers and tests get the final value at once (an sr-only
// copy, and `data-value`); with prefers-reduced-motion, or before the first effect, the final value is
// shown with no motion. Never blocks input.
import { useLayoutEffect, useRef, useState } from 'react';
import { cx } from './cx';

/** True when the person asked the system for less motion. */
export function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Animate 0 → `value` over `duration` ms (ease-out), restarting when `value` changes. */
export function useCountUp(value: number, { duration = 900, delay = 0 }: { duration?: number; delay?: number } = {}): number {
  const [shown, setShown] = useState(value);
  const from = useRef(0);
  // A layout effect: the count's first frame is painted instead of a flash of the final value.
  useLayoutEffect(() => {
    if (!Number.isFinite(value) || prefersReducedMotion()) {
      setShown(value);
      return;
    }
    const start0 = from.current;
    setShown(start0);
    let raf = 0;
    let start: number | null = null;
    const tick = (t: number) => {
      if (start === null) start = t + delay;
      const p = Math.min(1, Math.max(0, (t - start) / duration));
      const eased = 1 - (1 - p) ** 3;
      setShown(start0 + (value - start0) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      from.current = value;
    };
  }, [value, duration, delay]);
  return shown;
}

export type CountUpProps = {
  value: number;
  /** Formats the (animated) number, e.g. formatMoney. */
  format: (value: number) => string;
  duration?: number;
  /** ms before the count starts. */
  delay?: number;
  className?: string;
  'data-testid'?: string;
};

export function CountUp({ value, format, duration, delay, className, 'data-testid': testId }: CountUpProps) {
  const shown = useCountUp(value, { duration, delay });
  const final = format(value);
  return (
    <span className={cx('tabular-nums', className)} data-value={final} data-testid={testId}>
      <span aria-hidden="true">{format(shown)}</span>
      <span className="sr-only">{final}</span>
    </span>
  );
}
