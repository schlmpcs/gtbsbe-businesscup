// Scenarios, Compare, Next Moves measured on the plan, and the event panel's with / without preview.
// Task MP6 (#166). Spec: docs/ENGINEERING.md → "Scenarios, Compare and moves on the plan". Every number
// comes from plan() (./plan.ts); nothing here words a result: the UI turns the data into copy.
//
// 1. baselineScenario(profile, area, asOf): id 'baseline', name "Baseline", the default assumptions
//    (retireAge 67, endAge 90 or the person's age if older, inflation = the area's CPI, today's dollars,
//    budget expenses, engine growth, withdrawal order cash → investments → retirement, savings split
//    from profile.retirementShare: cash 1 − r, retirement r, zero shares left out) and two events from
//    defaultEvent: Retire (birth year + retireAge) and Social Security (birth year + 67).
// 2. duplicateScenario(s, name, taken): a deep copy (nothing shared with `s`), a new scenario id and
//    new event ids, in the same order. A new id is the old one with its `_<n>` suffix replaced by the
//    smallest n ≥ 2 not used yet (scenario ids: `s.id` and `taken`; event ids: the source's and those
//    already given), cut to 64 characters. Deterministic: the engine has no clock and no random ids.
//    At most MAX_SCENARIOS scenarios: duplicating when `taken` already holds that many throws.
// 3. compareScenarios(a, b): years both plans have, net worth a, b and diff = b − a; the five KPIs
//    with diff = b − a (null when either is null); firstYearBAhead = the first year with
//    diff ≥ COMPARE_TIE; sentence data read in the year A retires (A's age = a.kpis.retireAge, clamped
//    to the shared years like plan() clamps it): the leader (|diff| ≥ COMPARE_TIE, else null), the gap,
//    and since when the leader has stayed ahead. Both plans must use the same display unit.
// 4. planMoveEffects(profile, accounts, scenario, moves, area): each move's patch applied to this
//    scenario's plan; effect = plan with the move − plan without it, at retirement and at the end.
//    The patch is applied to the profile (applyPatch), to the accounts (a debt's `apr` on the liability
//    account of that id, since plan() reads debts from the accounts) and, for `retirementShare`, to a
//    non-empty savings split: retirement gets the new share r, the other groups keep their proportions
//    of 1 − r (all of it to cash when they had none). Sorted by effectAtRetirement descending; ties by
//    kind order (MOVE_KINDS), then id. Debt ids in a patch must be the accounts' ids: take the
//    candidates from moveCandidates(accountsToProfile(accounts, profile)).
//    `successRateDelta` (Monte Carlo with the same seed before and after, top 3 only) waits for MP5.
// 5. previewEvent(profile, accounts, scenario, event, area): the plan with the event (enabled, in its
//    place when the scenario has it, else appended) and without it (removed). leftOverMonthly = the
//    with-event plan's take-home pay − spending − debt payments, averaged over the months of the
//    event's first plan year (its year clamped to the plan; the asOf year has 13 − asOf month months):
//    the recurring money left each month once the event starts. One-off costs and windfalls are left
//    out (the KPIs carry them). In the plan's display unit.
import {
  LIABILITY_GROUPS,
  MOVE_KINDS,
  type Account,
  type AreaData,
  type CompareKpi,
  type CompareSentenceData,
  type CompareYear,
  type EventPreview,
  type Money,
  type PlanAssumptions,
  type PlanEvent,
  type PlanEventContext,
  type PlanKpis,
  type PlanMoveEffect,
  type PlanResult,
  type Profile,
  type ProfilePatch,
  type Rate,
  type Scenario,
  type ScenarioComparison,
  type YearMonth,
} from '@lifeguessr/types';
import { planEndAgeDefault, planRetireAgeDefault, planWithdrawalOrderDefault } from './assumptions';
import { applyPatch } from './forecast';
import type { MoveCandidate } from './moves';
import { plan } from './plan';
import { defaultEvent } from './planEvents';
import { inflationAnnualOf } from './simulate';

/** Most scenarios a person keeps. */
export const MAX_SCENARIOS = 4;
/** Id and name of the scenario every new user starts with (the name is the user's to edit). */
export const BASELINE_SCENARIO_ID = 'baseline';
export const BASELINE_SCENARIO_NAME = 'Baseline';
/** Net worth gaps under this many dollars (they show as $0) count as a tie in Compare. */
export const COMPARE_TIE: Money = 0.5;

/** Longest scenario or event id (ScenarioSchema, PlanEventSchema). */
const ID_MAX_LENGTH = 64;
/** Compare's KPI rows, in PlanKpis order. */
const KPI_KEYS = ['netWorthEndOfYear', 'netWorthAtRetirement', 'retireAge', 'netWorthAtEnd', 'shortfallAge'] as const satisfies
  readonly (keyof PlanKpis)[];

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

// ----- 1. Baseline ----------------------------------------------------------------------------

/** The savings split for a retirement share r: cash 1 − r, retirement r, zero shares left out. */
function savingsSplitOf(share: Rate): PlanAssumptions['savingsSplit'] {
  const r = clamp01(share);
  const split: PlanAssumptions['savingsSplit'] = [];
  if (r < 1) split.push({ group: 'cash', share: 1 - r });
  if (r > 0) split.push({ group: 'retirement', share: r });
  return split;
}

/** The scenario every new user starts with, so /plan is never empty. See the header. */
export function baselineScenario(profile: Profile, area: AreaData | null | undefined, asOf: YearMonth): Scenario {
  const assumptions: PlanAssumptions = {
    retireAge: planRetireAgeDefault.value,
    endAge: Math.max(planEndAgeDefault.value, Math.round(profile.age.value)),
    inflation: inflationAnnualOf(area),
    display: 'today',
    expenses: { mode: 'budget' },
    growth: {},
    withdrawalOrder: [...planWithdrawalOrderDefault.value],
    savingsSplit: savingsSplitOf(profile.retirementShare.value),
  };
  const ctx: PlanEventContext = { profile, assumptions, asOf, ...(area && { area }) };
  return {
    id: BASELINE_SCENARIO_ID,
    name: BASELINE_SCENARIO_NAME,
    assumptions,
    events: [defaultEvent('retire', ctx), defaultEvent('socialSecurity', ctx)],
  };
}

// ----- 2. Duplicate ---------------------------------------------------------------------------

/** `id` with its `_<n>` suffix replaced by the smallest n ≥ 2 that `used` doesn't hold, ≤ 64 characters. */
function nextId(id: string, used: ReadonlySet<string>): string {
  const root = id.replace(/_\d+$/, '');
  for (let n = 2; ; n++) {
    const suffix = `_${n}`;
    const candidate = root.slice(0, ID_MAX_LENGTH - suffix.length) + suffix;
    if (!used.has(candidate)) return candidate;
  }
}

/**
 * A copy of `s` named `name`, with a new id (not `s.id` nor any of `taken`, the scenario ids in use)
 * and new event ids. Nothing is shared with `s`. Throws a RangeError when `taken` already holds
 * MAX_SCENARIOS ids.
 */
export function duplicateScenario(s: Scenario, name: string, taken: readonly string[] = []): Scenario {
  if (taken.length >= MAX_SCENARIOS) throw new RangeError(`At most ${MAX_SCENARIOS} scenarios`);
  const copy = clone(s);
  const eventIds = new Set(s.events.map((e) => e.id));
  const events = copy.events.map((e) => {
    const id = nextId(e.id, eventIds);
    eventIds.add(id);
    return { ...e, id };
  });
  return { ...copy, id: nextId(s.id, new Set([s.id, ...taken])), name, events };
}

// ----- 3. Compare -----------------------------------------------------------------------------

/** Plans A and B side by side: yearly net worth, KPI differences (B − A) and the sentence data. See the header. */
export function compareScenarios(a: PlanResult, b: PlanResult): ScenarioComparison {
  if (a.display !== b.display) throw new RangeError(`Cannot compare ${a.display} with ${b.display} dollars`);
  const bByYear = new Map(b.years.map((y) => [y.year, y]));
  const shared = a.years.flatMap((ya) => {
    const yb = bByYear.get(ya.year);
    return yb ? [{ age: ya.age, year: ya.year, a: ya.netWorth, b: yb.netWorth }] : [];
  });
  if (shared.length === 0) throw new RangeError('The plans share no year');

  const years: CompareYear[] = shared.map((y) => ({ year: y.year, a: y.a, b: y.b, diff: y.b - y.a }));
  const kpis: CompareKpi[] = KPI_KEYS.map((key) => {
    const va = a.kpis[key];
    const vb = b.kpis[key];
    return { key, a: va, b: vb, diff: va === null || vb === null ? null : vb - va };
  });
  const firstYearBAhead = years.find((y) => y.diff >= COMPARE_TIE)?.year ?? null;

  // The year A retires, clamped to the shared years.
  const retireAge = a.kpis.retireAge;
  let at = shared.findIndex((y) => y.age === retireAge);
  if (at < 0) at = retireAge < shared[0]!.age ? 0 : shared.length - 1;
  const diff = years[at]!.diff;
  const leader = diff >= COMPARE_TIE ? 'b' : diff <= -COMPARE_TIE ? 'a' : null;
  const ahead = (d: Money) => (leader === 'b' ? d >= COMPARE_TIE : d <= -COMPARE_TIE);
  let since: number | null = null;
  if (leader !== null) {
    let from = at;
    while (from > 0 && ahead(years[from - 1]!.diff)) from--;
    since = years[from]!.year;
  }
  const sentence: CompareSentenceData = { leader, amount: Math.abs(diff), year: years[at]!.year, age: shared[at]!.age, since };
  return { years, kpis, firstYearBAhead, sentence };
}

// ----- 4. Next Moves on the plan --------------------------------------------------------------

/** The savings split with retirement at `share` and the other groups scaled to fill the rest. */
function splitWithRetirementShare(split: PlanAssumptions['savingsSplit'], share: Rate): PlanAssumptions['savingsSplit'] {
  const r = clamp01(share);
  const rest = 1 - r;
  const others = split.filter((s) => s.group !== 'retirement');
  const othersTotal = others.reduce((sum, s) => sum + s.share, 0);
  const out = split.map((s) => ({
    group: s.group,
    share: s.group === 'retirement' ? r : othersTotal > 0 ? (s.share / othersTotal) * rest : 0,
  }));
  if (!out.some((s) => s.group === 'retirement')) out.push({ group: 'retirement', share: r });
  if (othersTotal <= 0 && rest > 0) {
    const cash = out.find((s) => s.group === 'cash');
    if (cash) cash.share = rest;
    else out.push({ group: 'cash', share: rest });
  }
  return out.filter((s) => s.share > 0);
}

function patchScenario(s: Scenario, patch: ProfilePatch): Scenario {
  if (patch.retirementShare === undefined || s.assumptions.savingsSplit.length === 0) return s;
  return {
    ...s,
    assumptions: { ...s.assumptions, savingsSplit: splitWithRetirementShare(s.assumptions.savingsSplit, patch.retirementShare) },
  };
}

function patchAccounts(accounts: readonly Account[], patch: ProfilePatch): readonly Account[] {
  const apr = new Map((patch.debts ?? []).flatMap((d) => (d.apr === undefined ? [] : [[d.id, d.apr] as const])));
  if (apr.size === 0) return accounts;
  return accounts.map((acc) => (apr.has(acc.id) && isLiability(acc) ? { ...acc, apr: apr.get(acc.id)! } : acc));
}

const isLiability = (acc: Account) => (LIABILITY_GROUPS as readonly string[]).includes(acc.group);

/**
 * Each move measured on this scenario's plan (with − without, in the plan's display unit), sorted by
 * effectAtRetirement descending (ties: kind order, then id). See the header.
 */
export function planMoveEffects(
  profile: Profile, accounts: readonly Account[], scenario: Scenario, moves: readonly MoveCandidate[], area?: AreaData,
): PlanMoveEffect[] {
  if (moves.length === 0) return [];
  const base = plan(profile, accounts, scenario, area).kpis;
  return moves
    .map((m) => {
      const k = plan(applyPatch(profile, m.patch), patchAccounts(accounts, m.patch), patchScenario(scenario, m.patch), area).kpis;
      return {
        kind: m.kind,
        effect: {
          moveId: m.id,
          effectAtRetirement: k.netWorthAtRetirement - base.netWorthAtRetirement,
          effectAtEnd: k.netWorthAtEnd - base.netWorthAtEnd,
        } satisfies PlanMoveEffect,
      };
    })
    .sort((x, y) =>
      y.effect.effectAtRetirement - x.effect.effectAtRetirement ||
      MOVE_KINDS.indexOf(x.kind) - MOVE_KINDS.indexOf(y.kind) ||
      (x.effect.moveId < y.effect.moveId ? -1 : x.effect.moveId > y.effect.moveId ? 1 : 0))
    .map((x) => x.effect);
}

// ----- 5. Event preview -----------------------------------------------------------------------

/** The plan's KPIs with the event on and without it, and the money left each month once it starts. See the header. */
export function previewEvent(
  profile: Profile, accounts: readonly Account[], scenario: Scenario, event: PlanEvent, area?: AreaData,
): EventPreview {
  const on = { ...event, enabled: true } as PlanEvent;
  const has = scenario.events.some((e) => e.id === event.id);
  const withEvents = has ? scenario.events.map((e) => (e.id === event.id ? on : e)) : [...scenario.events, on];
  const withPlan = plan(profile, accounts, { ...scenario, events: withEvents }, area);
  const without = plan(profile, accounts, { ...scenario, events: scenario.events.filter((e) => e.id !== event.id) }, area);

  const first = withPlan.years[0]!.year;
  const last = withPlan.years[withPlan.years.length - 1]!.year;
  const year = Math.min(Math.max(event.year, first), last);
  const py = withPlan.years[year - first]!;
  const months = year === first ? 13 - Number(profile.asOf!.slice(5, 7)) : 12;
  const amount = (list: { key: string; amount: Money }[], key: string) => list.find((x) => x.key === key)?.amount ?? 0;
  const left = amount(py.cashFlow.income, 'takeHomePay') -
    amount(py.cashFlow.expenses, 'spending') - amount(py.cashFlow.expenses, 'debtPayments');
  return { withEvent: withPlan.kpis, without: without.kpis, leftOverMonthly: left / months };
}
