// Where the subscription audit meets the pieces that are not part of it (M5, issue #81).
//
// `useSubscriptions(profile, deps)` takes four things from outside, so it can be built and tested
// before they exist:
//   - `catalogue`  the known services (M4, `knownServices` of @lifeguessr/data)       WAITS: not in this branch
//   - `store`      the tool's slice of the local store (M2, `tools.subscriptions`)    WAITS on #78 (PR #95)
//   - `track`      the event sender (lib/events `track`)                              wired by default
//   - `categorize` the statement categorizer client (lib/api/statement)               wired by default
// While the first two are not connected, `useSubscriptionsDeps` answers null and the page says the
// tool is not switched on. Wiring them is the three lines marked WIRING below, and nothing else.
import type { SubscriptionsDeps } from './useSubscriptions';

/** Everything `useSubscriptions` needs from outside, or null while the catalogue and the store are not connected. */
export function useSubscriptionsDeps(): SubscriptionsDeps | null {
  // WIRING 1 (M4 on this branch): import { knownServices } from '@lifeguessr/data';
  // WIRING 2 (M2 on this branch): import { useAppStore } from '@/state'; import { restoreTools } from '@/state/tools';
  //   const state = useAppStore((s) => s.tools.subscriptions);
  //   const setTool = useAppStore((s) => s.setTool);
  //   const clearTool = useAppStore((s) => s.clearTool);
  // WIRING 3: return { catalogue: knownServices, store: { state, save: (next) => setTool('subscriptions', next), clear: () => clearTool('subscriptions') } };
  //   (memoize the `store` object on [state, setTool, clearTool]; `catalogue` is a module constant.)
  return null;
}
