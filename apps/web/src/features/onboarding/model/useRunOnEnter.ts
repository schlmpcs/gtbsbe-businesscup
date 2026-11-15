// Chapter 4 runs the Chance of success simulation (the engine's monteCarlo via useChanceOfSuccess) as
// soon as it opens, once per visit to the chapter (the month may have changed since the last run).
import { useEffect, useRef } from 'react';
import type { ChanceOfSuccessVM } from './types';

export function useRunChanceOnEnter(chance: ChanceOfSuccessVM, active: boolean, ready: boolean): void {
  const ran = useRef(false);
  const { status, run } = chance;
  useEffect(() => {
    if (!active) {
      ran.current = false;
      return;
    }
    // Run on entering; run again if the result went stale meanwhile (the plan re-seeded or changed: idle).
    if (!ready || status === 'running' || (ran.current && status !== 'idle')) return;
    ran.current = true;
    run();
  }, [active, ready, status, run]);
}
