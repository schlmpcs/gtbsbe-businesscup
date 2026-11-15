// Pure Profile updates the client makes on the user's behalf. Values the user states are measured
// (`isEstimate: false`); values we fill in stay estimates. None of these invent a number: they
// copy user input or measured statement totals, and averages of those totals.
import {
  amortizedPayment, applyPatch, cardMinPaymentFor, debtTermMonthsDefault, defaultHome, inflationAnnualOf, ownerCosts,
  statementAverages,
} from '@lifeguessr/engine';
import {
  COST_CATEGORIES, LifeEventSchema, MAX_LIFE_EVENTS,
  type AreaData, type CategoryTotals, type CostCategory, type Debt, type Estimate, type Home, type HomeTenure, type LifeEvent,
  type LifeEventPreset, type Money, type Profile, type ProfilePatch, type Rate, type YearMonth,
} from '@lifeguessr/types';

/** Scalar Profile fields the balance sheet edits. */
export type ProfileField = 'age' | 'takeHomePay' | 'cash' | 'retirement' | 'retirementShare';

const measured = <T>(value: T) => ({ value, isEstimate: false });

/** A spending category set by the user (slider or form): measured from now on. */
export function setSpending(p: Profile, category: CostCategory, value: Money): Profile {
  return { ...p, spending: { ...p.spending, [category]: measured(value) } };
}

/**
 * The subscription audit's monthly total as the subscriptions line (M5). Measured when it comes from
 * a statement; an estimate while any ticked service (a catalogue price) is in it.
 */
export function setSubscriptionsLine(p: Profile, monthly: Money, measuredFromStatement: boolean): Profile {
  return { ...p, spending: { ...p.spending, subscriptions: { value: monthly, isEstimate: !measuredFromStatement } } };
}

/** A balance-sheet field set by the user: measured. */
export function setField(p: Profile, field: ProfileField, value: number): Profile {
  return { ...p, [field]: measured(value) };
}

/** The user skipped a field: keep today's value but mark it as an estimate. */
export function skipField(p: Profile, field: ProfileField): Profile {
  return { ...p, [field]: { value: p[field].value, isEstimate: true } };
}

/**
 * A patch the user confirmed (e.g. parsed from their own words). Applied with the engine's
 * `applyPatch`; the spending categories and retirementShare it sets become measured, because the
 * user stated them. (A Next Move's patch keeps the flags instead: see `applyPatch`.)
 */
export function applyUserPatch(p: Profile, patch: ProfilePatch): Profile {
  const next = applyPatch(p, patch);
  const spending = { ...next.spending };
  for (const c of Object.keys(patch.spending ?? {}) as CostCategory[]) {
    if (patch.spending?.[c] !== undefined) spending[c] = measured(spending[c].value);
  }
  return {
    ...next,
    spending,
    retirementShare: patch.retirementShare !== undefined ? measured(next.retirementShare.value) : next.retirementShare,
  };
}

/**
 * Today's estimate of a skipped minimum payment: the card issuer formula (interest + 1% of the
 * balance, floor $25; engine `cardMinPaymentFor`), used for every kind but a mortgage until the user
 * types their payment. A mortgage (JF4) is amortized over the default 30-year term instead (the card
 * formula would ask $4,600 a month on $300,000). It stays an estimate.
 */
export function estimatedMinPayment(balance: Money, apr: Rate, kind?: Debt['kind']): Money {
  return kind === 'mortgage'
    ? amortizedPayment(balance, apr, debtTermMonthsDefault.value.mortgage)
    : cardMinPaymentFor(balance, apr);
}

/** A new debt id for a kind that is unique in the profile: 'card-2', 'student-1', ... */
export function newDebtId(p: Profile, kind: Debt['kind']): string {
  const used = new Set(p.debts.map((d) => d.id));
  for (let n = 1; ; n++) {
    const id = `${kind}-${n}`;
    if (!used.has(id)) return id;
  }
}

/** Debt fields the balance sheet edits. `minPayment: null` = the user skipped it (estimate). */
export type DebtInput = { kind: Debt['kind']; balance: Money; apr: Rate; minPayment: Money | null };

function debtFrom(id: string, input: DebtInput, extraPayment?: Money): Debt {
  const minPayment =
    input.minPayment === null
      ? { value: estimatedMinPayment(input.balance, input.apr, input.kind), isEstimate: true }
      : measured(input.minPayment);
  return { id, kind: input.kind, balance: input.balance, apr: input.apr, minPayment, ...(extraPayment ? { extraPayment } : {}) };
}

/** Add a debt; returns the new profile and the debt's id. */
export function addDebt(p: Profile, input: DebtInput): { profile: Profile; id: string } {
  const id = newDebtId(p, input.kind);
  return { profile: { ...p, debts: [...p.debts, debtFrom(id, input)] }, id };
}

/** Replace a debt's fields (unknown ids are ignored). Keeps the debt's extraPayment. */
export function updateDebt(p: Profile, id: string, input: DebtInput): Profile {
  return { ...p, debts: p.debts.map((d) => (d.id === id ? debtFrom(id, input, d.extraPayment) : d)) };
}

export function removeDebt(p: Profile, id: string): Profile {
  return { ...p, debts: p.debts.filter((d) => d.id !== id) };
}

// ----- Home (JF4, #136) ----------------------------------------------------------------------------

/** Home fields the user types on S8; each becomes measured. */
export type HomeInput = { value?: Money; hoaMonthly?: Money; appreciation?: Rate };

/** The housing line of an owner: `ownerCosts(home, area).total`, an estimate unless every line is measured. */
export function ownerHousingLine(home: Home, area: AreaData | null): Estimate<Money> {
  const costs = ownerCosts(home, area ?? undefined);
  return { value: costs.total, isEstimate: costs.lines.some((l) => l.isEstimate) };
}

/** The rent a renter starts from in this area: HUD gross rent for their bedrooms (S6 default: 1), an estimate. */
export function areaRentLine(p: Profile, area: AreaData | null): Estimate<Money> | null {
  if (!area) return null;
  const bedrooms = p.householdFacts?.bedrooms ?? 1;
  return { value: area.rentByBedrooms[bedrooms].value, isEstimate: true };
}

/**
 * Rent or own (S8 "Your home"). Owning keeps the current home with the new tenure, else starts from
 * `defaultHome` (area median value and appreciation, estimates); typed fields in `input` become
 * measured; the housing line becomes the owner costs. Renting drops `home` and puts back the rent:
 * `rentBefore` (the line as it was before owning, which may be the person's own number), else the
 * area's default rent, else the line as it is. Returns the rent to keep for a later switch back.
 */
export function setHome(
  p: Profile, tenure: HomeTenure, area: AreaData | null, input: HomeInput, rentBefore: Estimate<Money> | null,
): { profile: Profile; rentBefore: Estimate<Money> | null } {
  if (tenure === 'rent') {
    if (!p.home) return { profile: p, rentBefore };
    const { home: _home, ...rest } = p;
    const rent = rentBefore ?? areaRentLine(p, area) ?? p.spending.rentUtilities;
    return { profile: { ...rest, spending: { ...p.spending, rentUtilities: { ...rent } } }, rentBefore: null };
  }
  const base = p.home ? { ...p.home, tenure } : defaultHome(tenure, area ?? undefined, inflationAnnualOf(area))!;
  const home: Home = {
    ...base,
    ...(input.value !== undefined ? { value: measured(input.value) } : {}),
    ...(input.appreciation !== undefined ? { appreciation: measured(input.appreciation) } : {}),
    ...(input.hoaMonthly !== undefined ? { hoaMonthly: input.hoaMonthly } : {}),
  };
  return {
    profile: { ...p, home, spending: { ...p.spending, rentUtilities: ownerHousingLine(home, area) } },
    // The rent is kept from the moment the person starts owning, not overwritten by later edits.
    rentBefore: p.home ? rentBefore : { ...p.spending.rentUtilities },
  };
}

/** Months merged into the stored history: one entry per month (the newest upload wins), oldest first. */
export function mergeStatementHistory(existing: readonly CategoryTotals[], incoming: readonly CategoryTotals[]): CategoryTotals[] {
  const byMonth = new Map<string, CategoryTotals>();
  for (const m of existing) byMonth.set(m.month, m);
  for (const m of incoming) byMonth.set(m.month, m);
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Statement totals → Profile: each category becomes its monthly mean (measured), taken over the
 * months the statement covers in full (`statementAverages`), so an export that stops on the 12th
 * doesn't pull every category down. One-off charges are not in `totals`, so they don't inflate the
 * figures. Pay detected in the statement becomes take-home pay. A category the averages leave out
 * (housing or groceries the statement shows none of: paid from another account) keeps its value
 * and flag, so a card-only statement never claims the rent is $0.
 */
export function mergeStatementTotals(p: Profile, months: readonly CategoryTotals[]): Profile {
  const avg = statementAverages(months);
  if (avg.months.length === 0) return p;
  const spending = { ...p.spending };
  for (const c of COST_CATEGORIES) {
    const value = avg.spending[c];
    if (value !== undefined) spending[c] = measured(value);
  }
  const takeHomePay = avg.takeHomePay !== null ? measured(avg.takeHomePay) : p.takeHomePay;
  return { ...p, spending, takeHomePay };
}

// ----- Future life events (S10 "Coming up") ----------------------------------------------------
// Spec: docs/superpowers/specs/2026-11-15-life-events-design.md → Client.

/** A category a spending event may set (debts are modelled as debts). */
export type LifeEventCategory = Extract<LifeEvent, { kind: 'spending' }>['category'];

/** What `foldStartedEvents` did with one started event, for the one-line note on S10. */
export type FoldedNote =
  | { kind: 'pay'; month: YearMonth; preset?: LifeEventPreset }
  | { kind: 'spending'; month: YearMonth; preset?: LifeEventPreset; category: LifeEventCategory }
  | { kind: 'oneOff'; month: YearMonth; preset?: LifeEventPreset; direction: 'cost' | 'income' };

/** The profile without `asOf`: it is stamped when the profile is used (state/profile.ts), never stored. */
export function withoutAsOf(p: Profile): Profile {
  if (!('asOf' in p)) return p;
  const { asOf: _asOf, ...rest } = p;
  return rest;
}

/** A valid event (the contract's schema). */
export function isValidLifeEvent(e: LifeEvent): boolean {
  return LifeEventSchema.safeParse(e).success;
}

/** Add an event, or null when the profile already holds MAX_LIFE_EVENTS or the event is invalid. */
export function addLifeEvent(p: Profile, e: LifeEvent): Profile | null {
  const events = p.events ?? [];
  if (events.length >= MAX_LIFE_EVENTS || !isValidLifeEvent(e)) return null;
  return { ...p, events: [...events, e] };
}

/** Replace an event's fields, keeping its id and place in the list; null when the id is unknown or the event invalid. */
export function updateLifeEvent(p: Profile, id: string, e: LifeEvent): Profile | null {
  const events = p.events ?? [];
  const next: LifeEvent = { ...e, id };
  if (!events.some((x) => x.id === id) || !isValidLifeEvent(next)) return null;
  return { ...p, events: events.map((x) => (x.id === id ? next : x)) };
}

export function removeLifeEvent(p: Profile, id: string): Profile {
  return { ...p, events: (p.events ?? []).filter((e) => e.id !== id) };
}

function noteFor(e: LifeEvent): FoldedNote {
  const preset = e.preset !== undefined ? { preset: e.preset } : {};
  switch (e.kind) {
    case 'pay':
      return { kind: 'pay', month: e.month, ...preset };
    case 'spending':
      return { kind: 'spending', month: e.month, ...preset, category: e.category };
    case 'oneOff':
      return { kind: 'oneOff', month: e.month, ...preset, direction: e.direction };
  }
}

/**
 * Started events (month ≤ `currentMonth`) become today's values and leave the list: pay sets
 * `takeHomePay`, spending sets its category (value and isEstimate from the event), a one-off is in the
 * past and is dropped. Applied in month order (ties in list order), so the latest start wins. Returns
 * the same profile object when nothing has started.
 */
export function foldStartedEvents(p: Profile, currentMonth: YearMonth): { profile: Profile; notes: FoldedNote[] } {
  const events = p.events ?? [];
  // 'YYYY-MM' strings compare in calendar order.
  const started = events.filter((e) => e.month <= currentMonth);
  if (started.length === 0) return { profile: p, notes: [] };
  const inOrder = [...started].sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0)); // stable
  let next: Profile = { ...p, spending: { ...p.spending }, events: events.filter((e) => e.month > currentMonth) };
  for (const e of inOrder) {
    if (e.kind === 'pay') next = { ...next, takeHomePay: { ...e.takeHomePay } };
    else if (e.kind === 'spending') next.spending[e.category] = { ...e.monthly };
  }
  return { profile: next, notes: inOrder.map(noteFor) };
}
