// Pure parts of the subscription audit view-model (M5): ticks as findings, the reveal's miss factor
// and bucket, what counts, how a statement and the ticks combine, and the cancel plan's move.
// No React, no clock. The sums come from the engine (`auditTotals`); nothing here adds a new formula.
import { auditTotals, merchantKey, subsMissEdges, type MoveCandidate } from '@lifeguessr/engine';
import {
  CADENCE_MONTHS, MAX_ID_LENGTH, MISS_BUCKETS,
  type KnownService, type MissBucket, type Money, type Profile, type ServicePlan, type SubscriptionFinding,
} from '@lifeguessr/types';
import { TICK_LIST_MAX } from './constants';
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

/** The findings marked to cancel that still count (a marked finding that was dismissed or stopped counting is not). */
export function markedFindings(state: SubscriptionsToolState, catalogue: readonly KnownService[]): SubscriptionFinding[] {
  const { confirmed, merged } = combineFindings(state, catalogue);
  const marked = new Set(state.cancelMarked);
  return merged.filter((f) => marked.has(f.id) && isCounted(f, confirmed));
}

/**
 * The cancel marks after a new statement is read. A mark on a finding that is still in the audit stays.
 * A mark on a ticked service moves to the statement finding of the same service (the statement now
 * speaks for it); with no such finding it stays on the tick, as long as the service is still ticked.
 * Anything else (a finding that is gone, a tick of a service that is no longer ticked) is dropped, so
 * no id is left that points at nothing.
 */
export function carryMarks(
  marked: readonly string[],
  ticks: readonly Tick[],
  findings: readonly SubscriptionFinding[],
): string[] {
  const ids = new Set(findings.map((f) => f.id));
  const ticked = new Set(ticks.map((t) => t.serviceId));
  const carried: string[] = [];
  for (const id of marked) {
    let to: string | undefined;
    if (ids.has(id)) {
      to = id;
    } else if (id.startsWith(TICK_ID_PREFIX)) {
      const serviceId = id.slice(TICK_ID_PREFIX.length);
      if (ticked.has(serviceId)) to = findings.find((f) => f.serviceId === serviceId)?.id ?? id;
    }
    if (to !== undefined && !carried.includes(to)) carried.push(to);
  }
  return carried;
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
