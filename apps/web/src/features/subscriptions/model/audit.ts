// Pure parts of the subscription audit view-model (M5): ticks as findings, the reveal's miss factor
// and bucket, what counts, how a statement and the ticks combine, and the cancel plan's move.
// No React, no clock. The sums come from the engine (`auditTotals`); nothing here adds a new formula.
import { auditTotals, merchantKey, subsMissEdges, type MoveCandidate } from '@lifeguessr/engine';
import {
  CADENCE_MONTHS, MAX_ID_LENGTH, MISS_BUCKETS,
  type KnownService, type MissBucket, type Money, type Profile, type ServicePlan, type SubscriptionFinding,
} from '@lifeguessr/types';
import { MARK_PRICE_TOLERANCE, TICK_LIST_MAX } from './constants';
import type { SubscriptionsToolState, Tick } from './state';

/** Code-unit order, so the result does not depend on the locale (as the engine's audit order). */
const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const byYearlyThenId = (a: SubscriptionFinding, b: SubscriptionFinding) => b.yearly - a.yearly || compareText(a.id, b.id);

const isUsablePlan = (plan: ServicePlan) => Number.isFinite(plan.price) && plan.price > 0;

// ----- the tick-list -----------------------------------------------------------------------------

/** One row of the tick-list: a service, the plans that cost something, and the plan ticked by default. */
export type TickService = { service: KnownService; plans: ServicePlan[]; defaultPlan: ServicePlan };

/**
 * The tick-list: the catalogue's unambiguous services (an ambiguous merchant such as Apple bills many
 * products, so it cannot be ticked as one price), in catalogue order, at most TICK_LIST_MAX. A plan
 * that costs nothing is left out, and a service with no plan that costs anything is too.
 */
export function tickServices(catalogue: readonly KnownService[]): TickService[] {
  const list: TickService[] = [];
  for (const service of catalogue) {
    if (service.ambiguous) continue;
    const plans = service.plans.filter(isUsablePlan);
    const defaultPlan = plans[0];
    if (!defaultPlan) continue;
    list.push({ service, plans, defaultPlan });
    if (list.length === TICK_LIST_MAX) break;
  }
  return list;
}

/** Starts the id of every ticked service's finding, so it can never equal a statement finding's id (those are merchant slugs). */
export const TICK_ID_PREFIX = 'tick:';
export const tickIdOf = (serviceId: string): string => `${TICK_ID_PREFIX}${serviceId}`.slice(0, MAX_ID_LENGTH);

/** A plan's price per month, to the cent (a yearly plan ÷ 12, a quarterly one ÷ 3). */
export const monthlyOf = (price: Money, cadence: ServicePlan['cadence']): Money =>
  Math.round(Math.round(price * 100) / CADENCE_MONTHS[cadence]) / 100;

function tickFinding(service: KnownService, plan: ServicePlan): SubscriptionFinding {
  const cents = Math.round(plan.price * 100);
  const months = CADENCE_MONTHS[plan.cadence];
  return {
    id: tickIdOf(service.id),
    merchantKey: merchantKey(service.name) || service.id,
    label: service.name,
    serviceId: service.id,
    category: service.category,
    cadence: plan.cadence,
    amount: cents / 100,
    monthly: monthlyOf(plan.price, plan.cadence),
    yearly: Math.round((cents * 12) / months) / 100,
    chargesSeen: 0,
    lastCharge: null,
    nextExpected: null,
    status: 'active',
    flags: [],
    confidence: 'high',
    origin: 'tickList',
    isEstimate: true,
  };
}

/**
 * The ticked services as findings (origin 'tickList', an estimate: a catalogue price, nothing was
 * charged) and what they cost. A service is counted once (its first valid tick); ticks of services or
 * plans the catalogue does not have, and plans that cost nothing, are skipped. Totals come from the
 * engine's `auditTotals`, rounded to the cent once at the end.
 */
export function auditFromTicks(
  ticks: readonly Tick[],
  catalogue: readonly KnownService[],
): { findings: SubscriptionFinding[]; monthlyTotal: Money; yearlyTotal: Money } {
  const services = new Map(catalogue.map((s) => [s.id, s]));
  const seen = new Set<string>();
  const findings: SubscriptionFinding[] = [];
  for (const tick of ticks) {
    if (seen.has(tick.serviceId)) continue;
    const service = services.get(tick.serviceId);
    const plan = service?.plans.find((p) => p.id === tick.planId);
    if (!service || !plan || !isUsablePlan(plan)) continue;
    seen.add(tick.serviceId);
    findings.push(tickFinding(service, plan));
  }
  findings.sort(byYearlyThenId);
  return { findings, ...auditTotals(findings) };
}

// ----- the reveal --------------------------------------------------------------------------------

const cents = (money: Money): number => Math.round(money * 100);

/** guess ÷ actual, or null without a guess or when the actual total is 0 (then only the total is shown). */
export function missFactor(guess: Money | null, actual: Money): number | null {
  if (guess === null || !Number.isFinite(guess) || !(actual > 0)) return null;
  return guess / actual;
}

/**
 * The bucket of guess ÷ actual (event `subs_revealed`), or null when there is no factor. Decided in
 * whole cents (guess × d < actual × n), so a guess of exactly 0.8 of the total is never pushed into
 * the lower bucket by floating point (5.6 ÷ 7 is 0.7999999999999999 as a double).
 */
export function missBucketOf(guess: Money | null, actual: Money): MissBucket | null {
  if (missFactor(guess, actual) === null) return null;
  const g = cents(guess!);
  const a = cents(actual);
  for (const [i, [n, d]] of subsMissEdges.value.entries()) if (g * d < a * n) return MISS_BUCKETS[i]!;
  return MISS_BUCKETS[MISS_BUCKETS.length - 1]!;
}

// ----- findings ----------------------------------------------------------------------------------

/** Whether a finding is in the totals: active, and not low confidence unless the person confirmed it (M3's rule, `auditTotals`). */
export const isCounted = (f: SubscriptionFinding, confirmed: ReadonlySet<string>): boolean =>
  f.status === 'active' && (f.confidence !== 'low' || confirmed.has(f.id));

/**
 * The statement's findings and the ticked services together, a service counted once: a ticked service
 * the statement already found (same `serviceId`, in any state) is dropped, because the statement
 * wins. Ordered like an audit: yearly cost descending, then id.
 */
export function mergeFindings(
  statement: readonly SubscriptionFinding[],
  ticked: readonly SubscriptionFinding[],
): SubscriptionFinding[] {
  const found = new Set(statement.flatMap((f) => (f.serviceId === undefined ? [] : [f.serviceId])));
  const tickedOnly = ticked.filter((f) => f.serviceId === undefined || !found.has(f.serviceId));
  return [...statement, ...tickedOnly].sort(byYearlyThenId);
}

/**
 * Everything the tool knows about a saved state: the statement's findings the person did not dismiss,
 * the ticked services as findings, both together (the statement wins) and which low-confidence
 * findings were confirmed.
 */
export function combineFindings(state: SubscriptionsToolState, catalogue: readonly KnownService[]) {
  const confirmed = new Set(state.confirmed);
  const dismissed = new Set(state.dismissed);
  const statement = (state.audit?.findings ?? []).filter((f) => !dismissed.has(f.id));
  const ticked = auditFromTicks(state.ticks, catalogue);
  const merged = mergeFindings(statement, ticked.findings);
  return { confirmed, statement, ticked, merged };
}

// ----- cancel marks ------------------------------------------------------------------------------
// A mark is kept as the person made it: on a statement finding by its id, on a ticked service by the
// service (`tick:<service>`), which does not change when a statement is replaced. Rule, in one place:
//
//   A mark exists only while it points at exactly one finding that counts. It points, now, at the finding
//   of that id; or, for a ticked service, at the statement finding of the service whose monthly price is the
//   ticked plan's (within a cent), the only one if there is only one, the tick's own finding when the
//   statement has none, and at nothing when several fit equally or none does (never a guess).
//   Any write that leaves a mark pointing at nothing, or at a finding that does not count (stopped,
//   waiting for a yes, dismissed), drops it in that write (`pruneMarks`), so no hidden mark can come back
//   when a later statement shows the charge active again.

/** The counted finding a mark points at now, or undefined (see the rule above). */
export function markTarget(
  mark: string,
  c: Pick<ReturnType<typeof combineFindings>, 'confirmed' | 'statement' | 'ticked' | 'merged'>,
): SubscriptionFinding | undefined {
  let target: SubscriptionFinding | undefined;
  if (mark.startsWith(TICK_ID_PREFIX)) {
    const tick = c.ticked.findings.find((f) => f.id === mark); // not ticked (any more): nothing
    if (!tick) return undefined;
    const found = c.statement.filter((f) => f.serviceId === tick.serviceId);
    if (found.length === 0) target = tick;
    else if (found.length === 1) target = found[0];
    else {
      const fitting = found.filter((f) => Math.abs(f.monthly - tick.monthly) <= MARK_PRICE_TOLERANCE + 1e-9);
      target = fitting.length === 1 ? fitting[0] : undefined;
    }
  } else {
    target = c.merged.find((f) => f.id === mark);
  }
  return target && isCounted(target, c.confirmed) ? target : undefined;
}

/** The marks that still point at exactly one counted finding each, in order; the rest are dropped. */
export function pruneMarks(state: SubscriptionsToolState, catalogue: readonly KnownService[]): string[] {
  const c = combineFindings(state, catalogue);
  const pointed = new Set<string>();
  const kept: string[] = [];
  for (const mark of state.cancelMarked) {
    const target = markTarget(mark, c);
    if (target === undefined || pointed.has(target.id)) continue;
    pointed.add(target.id);
    kept.push(mark);
  }
  return kept;
}

/** The marks left when the ones pointing at finding `id` (made on it, or through its ticked service) are taken off. */
export function marksWithout(state: SubscriptionsToolState, catalogue: readonly KnownService[], id: string): string[] {
  const c = combineFindings(state, catalogue);
  return state.cancelMarked.filter((mark) => mark !== id && markTarget(mark, c)?.id !== id);
}

/** The findings marked to cancel that still count (a mark that points at nothing, or at a finding that does not count, is not one). */
export function markedFindings(state: SubscriptionsToolState, catalogue: readonly KnownService[]): SubscriptionFinding[] {
  const c = combineFindings(state, catalogue);
  const ids = new Set(state.cancelMarked.flatMap((mark) => markTarget(mark, c)?.id ?? []));
  return c.merged.filter((f) => ids.has(f.id));
}

/**
 * The statement findings the person did not tick: counted charges whose service is not in `ticks`
 * (a finding with no service id, such as an Apple charge, cannot be matched, so it counts as not
 * ticked). Nothing is "forgotten" when nothing was ticked. Ids, in the findings' order.
 */
export function forgottenIds(
  statement: readonly SubscriptionFinding[],
  ticks: readonly Tick[],
  confirmed: ReadonlySet<string>,
): string[] {
  if (ticks.length === 0) return [];
  const ticked = new Set(ticks.map((t) => t.serviceId));
  return statement
    .filter((f) => isCounted(f, confirmed) && !(f.serviceId !== undefined && ticked.has(f.serviceId)))
    .map((f) => f.id);
}

/** What to call a finding: the catalogue's service name when it is known, else the statement label as it is. */
export function displayNameOf(f: SubscriptionFinding, catalogue: readonly KnownService[]): string {
  return (f.serviceId !== undefined ? catalogue.find((s) => s.id === f.serviceId)?.name : undefined) ?? f.label;
}

// ----- the cancel plan ---------------------------------------------------------------------------

/**
 * The cancel plan's move id. Not `cancelSubscriptions`, which is the engine's own candidate (half of
 * the subscriptions line): committing this one must not look like committing that one on S10.
 * The forecast route accepts it (letters, digits and `:`), and `moveKindOf` reads its kind.
 */
export const CANCEL_MOVE_ID = 'cancelSubscriptions:audit';

/**
 * The move "cancel what I marked": subscriptions spending lowered by the marked monthly amount, not
 * below 0, to the cent. A patch is absolute, so it is sized for this profile. The 10-year effect is
 * not computed here: it is measured by the same forecast as Next Moves.
 */
export function cancelCandidate(profile: Pick<Profile, 'spending'>, monthlySaving: Money): MoveCandidate {
  const to = Math.max(0, Math.round((profile.spending.subscriptions.value - monthlySaving) * 100) / 100);
  return {
    id: CANCEL_MOVE_ID,
    kind: 'cancelSubscriptions',
    level: 1,
    category: 'subscriptions',
    patch: { spending: { subscriptions: to } },
  };
}
