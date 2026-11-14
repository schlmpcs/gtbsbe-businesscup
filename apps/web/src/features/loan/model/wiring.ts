// Where the debt payoff planner (M13, issue #89) meets the pieces that are not part of it.
//
// `usePayoffPlanner(lab, options)` takes the payoff engine, the event sender, today's date and the saved picks
// from outside, so it could be built and tested before they existed. `usePayoffWiring()` is the one place that
// hands them over. Until the payoff engine is bound it answers null, and the Loan Lab page behaves exactly as
// it did before: the single-method payoff order card, no planner section.
//
// Bound here: the event sender (lib/events `track`), today (lib/dates `localMonthDay`) and streamer mode (`?stream=1`).
// Waiting, each a few lines marked WIRING below:
//   - the engine  (M12, issue #88: comparePayoff and extraToFinishBy of @lifeguessr/engine)  merged into main (28446f0), not in this branch
//   - the store   (M2, issue #78: `tools.payoff` and `setTool` in the app store)              merged into main (48acc77), not in this branch
// This branch is stacked on M1 (contracts), which main does not take yet; once it does, these are the lines to add.
import { useMemo } from 'react';
import { localMonthDay } from '@/lib/dates';
import { track } from '@/lib/events';
import type { PayoffEngine, PayoffPlannerOptions, PayoffStoredState } from './usePayoffPlanner';
import { useStreamerMode } from './useStreamerMode';

/**
 * The payoff engine, or null while it is not bound.
 * WIRING 1: import { comparePayoff, extraToFinishBy } from '@lifeguessr/engine'; then
 *   const PAYOFF_ENGINE: PayoffEngine | null = { comparePayoff, extraToFinishBy };
 */
const PAYOFF_ENGINE: PayoffEngine | null = null;

/** The planner's options on the real event sender and clock; `engine` (and, when there is one, the saved picks) come from the caller. */
export function payoffPlannerOptions(parts: {
  engine: PayoffEngine;
  stored?: PayoffStoredState;
  onStore?: (state: PayoffStoredState) => void;
  streamer?: boolean;
}): PayoffPlannerOptions {
  return { ...parts, track, today: () => ({ month: localMonthDay().month }) };
}

/** What the Loan Lab page passes to usePayoffPlanner: null (planner off) until the engine is bound. */
export function usePayoffWiring(): PayoffPlannerOptions | null {
  const streamer = useStreamerMode();
  // WIRING 2: import { useAppStore } from '@/state';
  //   const stored = useAppStore((s) => s.tools.payoff);   // PayoffToolState: { method, extra, targetMonths? }
  //   const setTool = useAppStore((s) => s.setTool);
  // WIRING 3: add `stored` and `onStore: (state) => setTool('payoff', state)` to the object below, and `stored`, `setTool`
  //   to the dependency list.
  return useMemo(() => (PAYOFF_ENGINE ? payoffPlannerOptions({ engine: PAYOFF_ENGINE, streamer }) : null), [streamer]);
}
