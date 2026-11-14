// Where the subscription audit meets the pieces that are not part of it (M5, issue #81).
//
// `useSubscriptions(profile, deps)` takes what it needs from outside, so it can be built and tested on
// fakes (apps/web/src/test/subscriptions.ts). This file connects the real ones:
//   - `catalogue`   the known services (M4, `knownServices` of @lifeguessr/data/subscriptions)
//   - `store`       the tool's slice of the app store (M2): `tools.subscriptions`, `setTool`, `clearTool`
//   - `importedStatement` a statement already read on this page (S9), taken once (features/upload)
//   - `track`, `trackTool`, `categorize`, `downloadRenewals`: the hook's own defaults (lib/events, lib/api/statement, lib/download)
import { knownServices } from '@lifeguessr/data/subscriptions';
import { useCallback, useMemo } from 'react';
import { takeStatementRead } from '@/features/upload/model/lastStatementRead';
import { useAppStore } from '@/state';
import type { SubscriptionsStore, SubscriptionsToolState } from './state';
import type { SubscriptionsDeps } from './useSubscriptions';

/** Everything `useSubscriptions` needs from outside, connected to the real catalogue and the app store. */
export function useSubscriptionsDeps(): SubscriptionsDeps {
  const state = useAppStore((s) => s.tools.subscriptions);
  const setTool = useAppStore((s) => s.setTool);
  const clearTool = useAppStore((s) => s.clearTool);
  const save = useCallback((next: SubscriptionsToolState) => setTool('subscriptions', next), [setTool]);
  const clear = useCallback(() => clearTool('subscriptions'), [clearTool]);
  // One object while the saved state is the same, so nothing built from it rebuilds on every render.
  const store: SubscriptionsStore = useMemo(() => ({ state, save, clear }), [state, save, clear]);
  return useMemo(() => ({ catalogue: knownServices, store, importedStatement: takeStatementRead }), [store]);
}
