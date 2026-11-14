// What if? Two choices, two futures. Spec: docs/ENGINEERING.md → What if?
//
// applyScenario(profile, scenario) turns a list of changes into a plan the rules forecast runs:
// a changed Profile plus scheduled purchases (`ScheduledPurchase`, which carry start and end
// months). compareFutures runs both plans through forecast() (today's dollars) and explains the gap.
//
// Each change becomes one or more tagged adjustments (term = the spending category or 'income' it
// moves). The plan is the profile with every adjustment applied; a term's own effect is the end
// value of the plan with only that term's adjustments, minus the plan as it is. `decidedBy` is the
// term whose effects differ most between A and B in the winner's favor.
//
// How each change is costed (every number from area data or a named assumption):
//   purchase  as in Can I Afford It?: cash/card purchases are paid off from the surplus
//             (`payOffFromSurplus`), loans amortize; a later start is priced in that month's dollars.
//   loan      a purchase of `loan.amount` financed by that loan.
//   move      rent: the bedroom count whose area rent is closest to the profile's rent, scaled by the
//             new area's rent for it over the old one's (no old area: the new area's rent for it);
//             childcare and groceries scale by the areas' price ratios; car running costs change by
//             the insurance difference + monthlyGallons × the gas price difference. Moved fields
//             become estimates. Income stays unless an income change is also given.
//   kid       childcare by age band (infant → toddler → preschool → school age, kidAgeBandMonths)
//             from the area the scenario ends in, kid groceries (kidGroceryFactor × groceries per
//             adult) and otherPerKidMonthly, from `inMonths` on.
//   income    take-home pay + monthlyDelta from this month (see takeHomeFromGrossRaise).
//   rent      rent + utilities set to `monthly` from this month.
//   payDebt   cash pays down the first debt of that kind today (capped at cash and the balance).
//
// Limits: spending, rent, move and income changes apply from month 0 (the forecast has no
// time-varying profile); purchases, loans and kids honor `inMonths`. Both futures use the same
// rates (the caller's, normally the home area's inflation), so they share one today's-dollars deflator.
import type {
  AreaData, CostCategory, FutureComparison, FutureSide, Goal, KidAge, LoanInput, Money, Profile, Purchase, Scenario,
  ScenarioChange, WhatIfTerm,
} from '@lifeguessr/types';
import { KID_AGES } from '@lifeguessr/types';
import { canAfford } from './afford';
import {
  kidAgeBandMonths, kidGroceryFactor, monthlyGallons, otherPerKidMonthly, raiseTakeHomeShare,
} from './assumptions';
import { cloneProfile, forecast } from './forecast';
import { goalStatus } from './goal';
import { amortizedPayment } from './loan/amortize';
import {
  type ForecastRates, type ScheduledPurchase, cardMinPaymentFor, forecastMonths, resolveRates, simulate, usesCardFormula,
} from './simulate';

export type WhatIfOptions = {
  /** AreaData for one of our ZIPs, or null (the engine has no data of its own). */
  areaOf: (zip: string) => AreaData | null;
  /** The area to cost from when the profile has no ZIP we know (the UI says which one it used). */
  homeArea?: AreaData | null;
  rates?: Partial<ForecastRates>;
};

export type CompareOptions = WhatIfOptions & { years?: number; goal?: Goal | null };

type Adjustment =
  | { term: WhatIfTerm; kind: 'spending'; category: CostCategory; delta: Money; isEstimate: boolean }
  | { term: 'income'; kind: 'income'; delta: Money; isEstimate: boolean }
  | { term: WhatIfTerm; kind: 'extra'; purchase: ScheduledPurchase; monthly: Money }
  | { term: 'debtPayments'; kind: 'paydown'; debtId: string; amount: Money; monthly: Money }
  | { term: null; kind: 'zip'; zip: string };

/** A scenario ready for forecast(): the changed profile and the purchases it schedules. */
export type ScenarioPlan = { profile: Profile; extra: ScheduledPurchase[] };

const BEDROOMS = [0, 1, 2, 3, 4] as const;

/** Monthly take-home change for a gross yearly raise (raiseTakeHomeShare; negative for a cut). */
export function takeHomeFromGrossRaise(grossYearly: Money): Money {
  if (!Number.isFinite(grossYearly)) throw new RangeError(`Invalid raise: ${grossYearly}`);
  return (grossYearly * raiseTakeHomeShare.value) / 12;
}

/** Month (from birth) each childcare age band starts. */
function bandStart(age: KidAge): number {
  const b = kidAgeBandMonths.value;
  const starts: Record<KidAge, number> = {
    infant: 0,
    toddler: b.infant,
    preschool: b.infant + b.toddler,
    schoolAge: b.infant + b.toddler + b.preschool,
  };
  return starts[age];
}

/** A purchase priced in month `start`'s dollars (prices rise with inflation until then). */
function priceAt(x: Purchase, factor: number): Purchase {
  if (factor === 1) return x;
  const scale = (l: LoanInput): LoanInput => ({
    ...l,
    amount: l.amount * factor,
    ...(l.downPayment !== undefined && { downPayment: l.downPayment * factor }),
    ...(l.fees !== undefined && { fees: l.fees * factor }),
  });
  return { ...x, amount: x.amount * factor, payWith: typeof x.payWith === 'object' ? { loan: scale(x.payWith.loan) } : x.payWith };
}

/** The monthly cost a purchase adds once it starts, in today's dollars. */
function monthlyOf(x: Purchase): Money {
  if (typeof x.payWith === 'object') {
    const l = x.payWith.loan;
    const principal = Math.max(0, l.amount - (l.downPayment ?? 0)) + (l.fees ?? 0);
    const loanMonthly = principal > 0 ? amortizedPayment(principal, l.apr, l.termMonths) : 0;
    return loanMonthly;
  }
  if (x.recurring === 'monthly') return x.amount;
  if (x.recurring === 'yearly') return x.amount / 12;
  return 0;
}

function applyAdjustment(p: Profile, extra: ScheduledPurchase[], a: Adjustment): void {
  switch (a.kind) {
    case 'spending': {
      const e = p.spending[a.category];
      p.spending[a.category] = { value: Math.max(0, e.value + a.delta), isEstimate: e.isEstimate || a.isEstimate };
      return;
    }
    case 'income':
      p.takeHomePay = {
        value: Math.max(0, p.takeHomePay.value + a.delta),
        isEstimate: p.takeHomePay.isEstimate || a.isEstimate,
      };
      return;
    case 'extra':
      extra.push(a.purchase);
      return;
    case 'paydown': {
      const d = p.debts.find((x) => x.id === a.debtId);
      if (!d) return;
      const amount = Math.min(a.amount, d.balance);
      d.balance -= amount;
      p.cash = { ...p.cash, value: p.cash.value - amount };
      return;
    }
    case 'zip':
      p.zip = a.zip;
      return;
  }
}

function materialize(base: Profile, adjustments: readonly Adjustment[]): ScenarioPlan {
  const profile = cloneProfile(base);
  const extra: ScheduledPurchase[] = [];
  for (const a of adjustments) applyAdjustment(profile, extra, a);
  return { profile, extra };
}

/** Bedroom count whose rent in `area` is closest to `rent`. */
function closestBedrooms(area: AreaData, rent: Money): (typeof BEDROOMS)[number] {
  let best: (typeof BEDROOMS)[number] = 1;
  for (const b of BEDROOMS) {
    if (Math.abs(area.rentByBedrooms[b].value - rent) < Math.abs(area.rentByBedrooms[best].value - rent)) best = b;
  }
  return best;
}

const childcareSum = (a: AreaData) => KID_AGES.reduce((s, k) => s + (a.childcareMonthly?.[k] ?? 0), 0);

function moveAdjustments(p: Profile, zip: string, opts: WhatIfOptions): Adjustment[] {
  const to = opts.areaOf(zip);
  if (!to) throw new RangeError(`No area data for ZIP ${zip}`);
  const from = (p.zip ? opts.areaOf(p.zip) : null) ?? opts.homeArea ?? null;
  const out: Adjustment[] = [];
  const set = (category: CostCategory, next: Money) => {
    const delta = next - p.spending[category].value;
    if (Math.abs(delta) > 1e-9) out.push({ term: category, kind: 'spending', category, delta, isEstimate: true });
  };

  const rent = p.spending.rentUtilities.value;
  if (rent > 0) {
    if (from) {
      const b = closestBedrooms(from, rent);
      const old = from.rentByBedrooms[b].value;
      set('rentUtilities', old > 0 ? (rent * to.rentByBedrooms[b].value) / old : to.rentByBedrooms[b].value);
    } else {
      set('rentUtilities', to.rentByBedrooms[closestBedrooms(to, rent)].value);
    }
  }
  const childcare = p.spending.childcare.value;
  if (childcare > 0 && from && childcareSum(from) > 0 && childcareSum(to) > 0) {
    set('childcare', (childcare * childcareSum(to)) / childcareSum(from));
  }
  const groceries = p.spending.groceries.value;
  if (groceries > 0 && from && from.groceriesPerAdult.value > 0) {
    set('groceries', (groceries * to.groceriesPerAdult.value) / from.groceriesPerAdult.value);
  }
  const car = p.spending.car.value;
  if (car > 0 && from) {
    const delta = to.carInsuranceMonthly.value - from.carInsuranceMonthly.value
      + monthlyGallons.value * (to.gasPerGallon.value - from.gasPerGallon.value);
    set('car', Math.max(0, car + delta));
  }
  out.push({ term: null, kind: 'zip', zip });
  return out;
}

function kidAdjustments(age: KidAge, inMonths: number, area: AreaData, horizon: number, inflation: number): Adjustment[] {
  const out: Adjustment[] = [];
  const grow = (start: number) => (1 + inflation) ** (start / 12);
  const monthlyCash = (label: string, amount: Money, start: number, end?: number): ScheduledPurchase => ({
    label, amount: amount * grow(start), recurring: 'monthly', payWith: 'cash', startMonth: start,
    ...(end !== undefined && { endMonth: end }),
  });
  const childcare = area.childcareMonthly;
  if (childcare) {
    const from = KID_AGES.indexOf(age);
    const offset = bandStart(age);
    for (let i = from; i < KID_AGES.length; i++) {
      const band = KID_AGES[i]!;
      const start = inMonths + bandStart(band) - offset;
      const next = KID_AGES[i + 1];
      const end = next ? inMonths + bandStart(next) - offset : undefined;
      if (start >= horizon) break;
      if (childcare[band] <= 0) continue;
      out.push({
        term: 'childcare', kind: 'extra', purchase: monthlyCash(`childcare-${band}`, childcare[band], start, end),
        monthly: i === from ? childcare[band] : 0,
      });
    }
  }
  const groceries = kidGroceryFactor.value * area.groceriesPerAdult.value;
  if (inMonths < horizon) {
    out.push({ term: 'groceries', kind: 'extra', purchase: monthlyCash('kid-groceries', groceries, inMonths), monthly: groceries });
    out.push({
      term: 'other', kind: 'extra', purchase: monthlyCash('kid-other', otherPerKidMonthly.value, inMonths),
      monthly: otherPerKidMonthly.value,
    });
  }
  return out;
}

function purchaseAdjustment(x: Purchase, category: CostCategory | undefined, inMonths: number, inflation: number): Adjustment {
  const term: WhatIfTerm = category ?? (typeof x.payWith === 'object' ? 'debtPayments' : 'other');
  const priced = priceAt(x, (1 + inflation) ** (inMonths / 12));
  return {
    term, kind: 'extra', purchase: { ...priced, startMonth: inMonths, payOffFromSurplus: true }, monthly: monthlyOf(x),
  };
}

/** Adjustments of a scenario, in order (kids last, so they are costed in the area the scenario ends in). */
function adjustmentsOf(base: Profile, scenario: Scenario, opts: WhatIfOptions, horizon: number): Adjustment[] {
  const inflation = resolveRates(opts.rates).inflationAnnual;
  const adjustments: Adjustment[] = [];
  const running = () => materialize(base, adjustments).profile;
  const kids: Extract<ScenarioChange, { kind: 'kid' }>[] = [];

  for (const c of scenario.changes) {
    switch (c.kind) {
      case 'purchase':
        adjustments.push(purchaseAdjustment(c.purchase, c.category, c.inMonths ?? 0, inflation));
        break;
      case 'loan':
        adjustments.push(purchaseAdjustment(
          { label: c.label ?? 'loan', amount: c.loan.amount, recurring: false, payWith: { loan: c.loan } },
          c.category, c.inMonths ?? 0, inflation,
        ));
        break;
      case 'move':
        adjustments.push(...moveAdjustments(running(), c.zip, opts));
        break;
      case 'kid':
        kids.push(c);
        break;
      case 'income':
        adjustments.push({ term: 'income', kind: 'income', delta: c.monthlyDelta, isEstimate: c.grossYearly !== undefined });
        break;
      case 'rent': {
        const delta = c.monthly - running().spending.rentUtilities.value;
        adjustments.push({ term: 'rentUtilities', kind: 'spending', category: 'rentUtilities', delta, isEstimate: false });
        break;
      }
      case 'payDebt': {
        const p = running();
        const d = p.debts.find((x) => x.kind === c.debtKind && x.balance > 0);
        if (!d) break;
        const amount = Math.min(c.amount ?? Number.POSITIVE_INFINITY, d.balance, Math.max(0, p.cash.value));
        if (amount <= 0) break;
        const monthly = usesCardFormula(d) ? cardMinPaymentFor(d.balance - amount, d.apr) - cardMinPaymentFor(d.balance, d.apr) : 0;
        adjustments.push({ term: 'debtPayments', kind: 'paydown', debtId: d.id, amount, monthly });
        break;
      }
    }
  }
  if (kids.length > 0) {
    const p = running();
    const area = (p.zip ? opts.areaOf(p.zip) : null) ?? opts.homeArea ?? null;
    if (!area) throw new RangeError('No area data to cost a child: give the profile a ZIP or a homeArea');
    for (const k of kids) adjustments.push(...kidAdjustments(k.age, k.inMonths ?? 0, area, horizon, inflation));
  }
  return adjustments;
}

/** The profile and scheduled purchases a scenario describes (the input profile is not changed). */
export function applyScenario(p: Profile, scenario: Scenario, opts: WhatIfOptions, years = 10): ScenarioPlan {
  return materialize(p, adjustmentsOf(p, scenario, opts, forecastMonths(years)));
}

/** The monthly change by term in the first month each change is in place (today's dollars). */
function monthlyByTerm(adjustments: readonly Adjustment[]): FutureSide['monthly'] {
  const sums = new Map<WhatIfTerm, Money>();
  for (const a of adjustments) {
    if (a.term === null) continue;
    const v = a.kind === 'extra' || a.kind === 'paydown' ? a.monthly : a.delta;
    if (v === 0) continue;
    sums.set(a.term, (sums.get(a.term) ?? 0) + v);
  }
  return [...sums].map(([term, delta]) => ({ term, delta }));
}

/**
 * Two futures side by side: the rules forecast of each scenario (today's dollars), its goal
 * verdict, its monthly change by term, Can I Afford It? for its purchases, the gap B − A at the
 * horizon and the term that decided it.
 */
export function compareFutures(p: Profile, A: Scenario, B: Scenario, opts: CompareOptions): FutureComparison {
  const years = opts.years ?? 10;
  const horizon = Math.round(years * 12);
  const months = forecastMonths(years);
  const rates = resolveRates(opts.rates);
  const deflator = (1 + rates.inflationAnnual) ** (horizon / 12);
  const endMid = (plan: ScenarioPlan) =>
    simulate(plan.profile, months, { rates, extra: plan.extra }).path[horizon]!.netWorth / deflator;
  const yearlyOf = <T extends { month: number }>(points: readonly T[]) => points.filter((x) => x.month % 12 === 0 && x.month <= horizon);

  const baseForecast = forecast(p, years, { todaysDollars: true, rates });
  const baseEnd = endMid({ profile: p, extra: [] });

  const side = (s: Scenario) => {
    const adjustments = adjustmentsOf(p, s, opts, months);
    const plan = materialize(p, adjustments);
    const f = forecast(plan.profile, years, { todaysDollars: true, rates, extra: plan.extra });
    const points = f.points.slice(0, horizon + 1);
    const profileOnly = materialize(p, adjustments.filter((a) => a.kind !== 'extra')).profile;
    const afford: FutureSide['afford'] = [];
    s.changes.forEach((c, index) => {
      if ((c.kind !== 'purchase' && c.kind !== 'loan') || (c.inMonths ?? 0) > 0) return;
      const x: Purchase = c.kind === 'purchase'
        ? c.purchase
        : { label: c.label ?? 'loan', amount: c.loan.amount, recurring: false, payWith: { loan: c.loan } };
      if (!(x.amount > 0)) return;
      const r = canAfford(profileOnly, x, { rates });
      afford.push({ index, verdict: r.verdict, ...(r.waitMonths !== undefined && { waitMonths: r.waitMonths }) });
    });
    const terms = new Set(adjustments.map((a) => a.term).filter((t): t is WhatIfTerm => t !== null));
    const effects = new Map<WhatIfTerm, Money>();
    for (const t of terms) effects.set(t, endMid(materialize(p, adjustments.filter((a) => a.term === t))) - baseEnd);
    const result: FutureSide = {
      points,
      end: points[horizon]!,
      yearly: yearlyOf(points),
      goal: opts.goal ? goalStatus(plan.profile, opts.goal, { rates, extra: plan.extra }) : null,
      monthly: monthlyByTerm(adjustments),
      afford,
    };
    return { result, effects };
  };

  const a = side(A);
  const b = side(B);
  const diff = b.result.end.mid - a.result.end.mid;

  let decidedBy: FutureComparison['decidedBy'] = null;
  if (Math.abs(diff) >= 0.5) {
    const sign = Math.sign(diff);
    const terms = new Set([...a.effects.keys(), ...b.effects.keys()]);
    for (const term of terms) {
      const effectA = a.effects.get(term) ?? 0;
      const effectB = b.effects.get(term) ?? 0;
      const gap = effectB - effectA;
      if (gap * sign > 0 && (decidedBy === null || gap * sign > decidedBy.gap * sign)) {
        decidedBy = { term, effectA, effectB, gap };
      }
    }
  }

  return {
    years,
    todaysDollars: true,
    source: 'rules',
    base: { end: baseForecast.points[horizon]!, yearly: yearlyOf(baseForecast.points) },
    A: a.result,
    B: b.result,
    diff,
    decidedBy,
  };
}
