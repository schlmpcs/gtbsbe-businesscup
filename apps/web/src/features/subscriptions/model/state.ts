// What the subscription audit keeps in this browser, and the one seam it keeps it through (M5).
//
// Browser-local only (issue #81, decision 2): nothing here is sent anywhere, and none of it enters the
// session or the database. Findings name merchants (masked statement labels), which is why. The raw
// statement lines are never kept at all: they are read, turned into findings, and dropped.
//
// The slice is the value of `tools.subscriptions` in the app store (M2, #78). The store is injected
// through `SubscriptionsStore`, so this feature has no import of it; when M2 lands, the slice's schema
// in packages/types/tools.ts must be this one (the report of PR for #81 has the diff).
import { MAX_ID_LENGTH, SUBSCRIPTION_FINDINGS_MAX, SubscriptionAuditSchema } from '@lifeguessr/types';
import { z } from 'zod';
import { TICKS_MAX } from './constants';

const id = z.string().min(1).max(MAX_ID_LENGTH);
/** Finding ids (statement findings and ticks) a person has made a choice about. */
const ids = z.array(id).max(SUBSCRIPTION_FINDINGS_MAX + TICKS_MAX).default([]);

export const TickSchema = z.strictObject({ serviceId: id, planId: id });

export const SubscriptionsToolStateSchema = z.strictObject({
  /** The monthly guess (0 is a guess). Absent until one is entered. */
  guess: z.number().finite().nonnegative().optional(),
  /** The services ticked, with the plan chosen. One entry per service. */
  ticks: z.array(TickSchema).max(TICKS_MAX).default([]).refine(
    (ticks) => new Set(ticks.map((t) => t.serviceId)).size === ticks.length,
    { message: 'a service is ticked once' },
  ),
  /** Low-confidence findings the person said are subscriptions: they count once confirmed. */
  confirmed: ids,
  /** Findings the person said are not subscriptions: hidden and never counted. */
  dismissed: ids,
  /** Findings (and ticked services) marked to cancel in the plan. */
  cancelMarked: ids,
  /** The last statement's findings, as the detector returned them (M3). Merchant labels are in here. */
  audit: SubscriptionAuditSchema.optional(),
});

export type SubscriptionsToolState = z.infer<typeof SubscriptionsToolStateSchema>;
export type Tick = z.infer<typeof TickSchema>;

/** The state of a person who has not done anything yet. */
export function emptyToolState(): SubscriptionsToolState {
  return { ticks: [], confirmed: [], dismissed: [], cancelMarked: [] };
}

/**
 * What was saved, read back safely: the state when it is valid, else undefined (the tool starts
 * empty; a damaged slice never takes anything else with it).
 */
export function restoreToolState(raw: unknown): SubscriptionsToolState | undefined {
  const parsed = SubscriptionsToolStateSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

/**
 * The tool's slice of the local store: the saved state (undefined before anything was saved), a save
 * and a clear. Wiring: M2's `tools.subscriptions`, `setTool('subscriptions', …)`, `clearTool('subscriptions')`.
 */
export type SubscriptionsStore = {
  state: SubscriptionsToolState | undefined;
  save: (next: SubscriptionsToolState) => void;
  clear: () => void;
};
