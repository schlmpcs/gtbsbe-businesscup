// What the subscription audit keeps in this browser, and the one seam it keeps it through (M5).
//
// Browser-local only (issue #81, decision 2): nothing here is sent anywhere, and none of it enters the
// session or the database. Findings name merchants (masked statement labels), which is why. The raw
// statement lines are never kept at all: they are read, turned into findings, and dropped.
//
// The slice is `tools.subscriptions` of the app store (M2) and its schema is the contract's
// (`SubscriptionToolStateSchema` in @lifeguessr/types): this file only names its types and reads a saved
// value back safely.
import { SubscriptionToolStateSchema, type ToolsState } from '@lifeguessr/types';

export type SubscriptionsToolState = NonNullable<ToolsState['subscriptions']>;
export type Tick = SubscriptionsToolState['ticks'][number];

/** The state of a person who has not done anything yet. */
export function emptyToolState(): SubscriptionsToolState {
  return { ticks: [], confirmed: [], dismissed: [], cancelMarked: [] };
}

/**
 * What was saved, read back safely: the state when it is valid, else undefined (the tool starts
 * empty; a damaged slice never takes anything else with it).
 */
export function restoreToolState(raw: unknown): SubscriptionsToolState | undefined {
  const parsed = SubscriptionToolStateSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

/**
 * The tool's slice of the local store: the saved state (undefined before anything was saved), a save
 * and a clear. Wiring: `tools.subscriptions`, `setTool('subscriptions', …)`, `clearTool('subscriptions')`
 * of the app store (./wiring.ts).
 */
export type SubscriptionsStore = {
  state: SubscriptionsToolState | undefined;
  save: (next: SubscriptionsToolState) => void;
  clear: () => void;
};
