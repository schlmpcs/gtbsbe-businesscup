'use client';

// A number that counts up to its value when it first shows (and glides when it changes). Display only:
// the value is the view-model's, `format` is a kit formatter; the exact final text is always in the DOM
// for screen readers (and tests). With prefers-reduced-motion it shows the final value at once.
import { useLayoutEffect, useRef, useState } from 'react';

export type CountUpProps = {
  value: number;
  format: (value: number) => string;
  /** Milliseconds (default 700). */
  duration?: number;
};

const reduced = () =>
  typeof window === 'undefined' ||
  typeof window.requestAnimationFrame !== 'function' ||
  (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);

export function CountUp({ value, format, duration = 700 }: CountUpProps) {
  const [shown, setShown] = useState<number | null>(null);
  const from = useRef(0);

  // A layout effect, so the first paint already starts from the old value instead of flashing the final one.
  useLayoutEffect(() => {
    if (!Number.isFinite(value) || reduced()) {
      from.current = value;
      setShown(null);
      return;
    }
    const start = from.current;
    if (start === value) {
      setShown(null);
      return;
    }
    const t0 = performance.now();
    let frame = 0;
    setShown(start);
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const v = start + (value - start) * (1 - Math.pow(1 - p, 3));
      from.current = p < 1 ? v : value;
      if (p < 1) {
        setShown(v);
        frame = requestAnimationFrame(step);
      } else setShown(null);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  if (shown === null) return <>{format(value)}</>;
  return (
    <>
      <span className="sr-only">{format(value)}</span>
      <span aria-hidden="true">{format(shown)}</span>
    </>
  );
}
