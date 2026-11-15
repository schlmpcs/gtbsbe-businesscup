'use client';

// A number that counts up to its value when it first shows (and glides when it changes). Display only:
// the value is the view-model's and `format` a kit formatter. React renders the exact final text; the
// animation only rewrites that text node frame by frame (no re-renders) and always ends on the final
// text. Skipped with prefers-reduced-motion, without requestAnimationFrame, and in jsdom (tests).
import { useLayoutEffect, useRef } from 'react';

export type CountUpProps = {
  value: number;
  format: (value: number) => string;
  /** Milliseconds (default 700). */
  duration?: number;
};

const canAnimate = () =>
  typeof window !== 'undefined' &&
  typeof window.requestAnimationFrame === 'function' &&
  !/jsdom/i.test(window.navigator.userAgent) &&
  !(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);

export function CountUp({ value, format, duration = 700 }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const from = useRef(0);
  const formatRef = useRef(format);
  useLayoutEffect(() => {
    formatRef.current = format;
  });

  useLayoutEffect(() => {
    const node = ref.current?.firstChild;
    const start = from.current;
    if (!node || !Number.isFinite(value) || start === value || !canAnimate()) {
      from.current = value;
      return;
    }
    const write = (v: number) => {
      node.nodeValue = formatRef.current(v);
    };
    write(start); // before the first paint, so the final number never flashes first
    const t0 = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const p = Math.min(1, (now - t0) / duration);
      const v = start + (value - start) * (1 - Math.pow(1 - p, 3));
      from.current = v;
      if (p < 1) {
        write(v);
        frame = requestAnimationFrame(step);
      } else {
        from.current = value;
        write(value);
      }
    });
    // React has already written the next value's text when this runs, so only stop the frames.
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <span ref={ref}>{format(value)}</span>;
}
