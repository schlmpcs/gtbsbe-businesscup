// Where the debt payoff planner (M13, issue #89) meets the pieces that are not part of it.
//
// `usePayoffPlanner(lab, options)` takes the payoff engine, the event sender, today's date and the saved picks
// from outside, so it could be built and tested before they existed. `usePayoffWiring()` is the one place that
// hands them over:
//   - the engine   comparePayoff and extraToFinishBy of @lifeguessr/engine (M12)
//   - the store    `tools.payoff` and `setTool` of the app store (M2): the picks are browser-local, never sent anywhere
//   - events       lib/events `track`. `tool_opened` goes through it with the key `tool:payoff`, the same event and key
//                  as `trackTool('payoff')`; the planner sends both of its events through one sender so a test sees them in order
//   - today        lib/dates `localMonthDay`, as a 'YYYY-MM' month
//   - streamer     `?stream=1` on the page
import { comparePayoff, extraToFinishBy } from '@lifeguessr/engine';
import { useMemo } from 'react';
import { localMonthDay } from '@/lib/dates';
import { track } from '@/lib/events';
import { useAppStore } from '@/state';
import type { PayoffEngine, PayoffPlannerOptions, PayoffStoredState } from './usePayoffPlanner';
import { useStreamerMode } from './useStreamerMode';

const PAYOFF_ENGINE: PayoffEngine = { comparePayoff, extraToFinishBy };

/** The planner's options on the real event sender and clock; the engine and, when there are any, the saved picks come from the caller. */
export function payoffPlannerOptions(parts: {
  engine: PayoffEngine;
  stored?: PayoffStoredState;
  onStore?: (state: PayoffStoredState) => void;
  streamer?: boolean;
}): PayoffPlannerOptions {
  return { ...parts, track, today: () => ({ month: localMonthDay().month }) };
}

/** What the Loan Lab page passes to usePayoffPlanner. */
export function usePayoffWiring(): PayoffPlannerOptions {
  const streamer = useStreamerMode();
  const stored = useAppStore((s) => s.tools.payoff);
  const setTool = useAppStore((s) => s.setTool);
  return useMemo(
    () => payoffPlannerOptions({ engine: PAYOFF_ENGINE, streamer, stored, onStore: (state) => setTool('payoff', state) }),
    [streamer, stored, setTool],
  );
}
