'use client';

// Entrance motion for /plan (CSS transitions only). `useEntered` is false on the first paint and true
// from the next frame, so a transition can run from its start state (line drawn from the left, gauge
// swept from 0, bars grown from the base). Pair every use with `MOTION` so prefers-reduced-motion jumps
// straight to the final state. Nothing waits on it: controls work during the transition.
import { useEffect, useState } from 'react';

/** Transition classes that respect prefers-reduced-motion. */
export const MOTION = 'transition-all duration-700 ease-out motion-reduce:transition-none';

/** True once the element has painted in its start state; a new `key` replays the entrance. */
export function useEntered(key: string | number = 0): boolean {
  const [enteredKey, setEnteredKey] = useState<string | number | null>(null);
  useEffect(() => {
    if (typeof requestAnimationFrame !== 'function') {
      const t = setTimeout(() => setEnteredKey(key), 16);
      return () => clearTimeout(t);
    }
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setEnteredKey(key));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [key]);
  return enteredKey === key;
}
