// Life events: the what-if timeline. A Profile plus events placed on a 10-year timeline becomes a
// time-varying simulation: the same `forecast()` the rules provider runs, with month-indexed changes
// to take-home pay and spending (`adjust`) and scheduled purchases (`extra`) for cars and one-offs.
//
// Rules (all in today's dollars; month t is 0-based, an event with startYear y starts at t = 12·y):
// - baby: from its start, each month adds childcare for the child's age (NDCP age groups, see
//   `kidAgeBandStartMonths`), kidGroceryFactor × groceriesPerAdult and otherPerKidMonthly, all priced
//   in the area the person lives in that month (home, or the latest move that has started).
// - move: from its start, your own rent, groceries and childcare are scaled by the price ratio of the
//   new area to home (HUD rent for `bedrooms`, USDA groceries per adult, NDCP preschool childcare); with
//   a car (spending.car > 0), insurance and fuel change by the difference in area prices. A later move
//   replaces an earlier one. Without home area data, rent becomes the new area's HUD rent and the other
//   lines are left out (nothing to scale by).
// - car: an additional car bought in its start month on a loan (the simulation's loan purchases:
//   down payment from cash, amortized payment from the next month), plus insurance and fuel priced in
//   the area of each month. Prices are today's dollars, so the price paid is inflated to the start month.
// - raise: take-home pay changes by an amount, or by `rate` × today's take-home pay.
// - purchase: paid from cash in its start month (inflated to then); a shortfall goes on a card, as in
//   every forecast.
// Pure: no I/O, no clock; area data is passed in.
import type {
  AreaData, KidAge, LifeEvent, LifeEventEffect, LifeEventLine, LifeEventsResult, Money, Profile,
} from '@lifeguessr/types';
import {
  assumptionSource, kidAgeBandStartMonths, kidGroceryFactor, lifeEventBedroomsDefault, monthlyGallons,
  otherPerKidMonthly, yourInputSource,
} from './assumptions';
import { forecast } from './forecast';
import { amortizedPayment } from './loan/amortize';
import { type ForecastRates, type MonthlyAdjust, type ScheduledPurchase, forecastMonths, resolveRates } from './simulate';

/** The timeline's length: events start in year 0–10 and the result is read at 10 years. */
export const LIFE_EVENTS_YEARS = 10;

export type LifeEventsOptions = {
  /** Area data of the person's ZIP, or null when it is not covered. */
  home: AreaData | null;
  /** Every area a move can go to (a move's `toZip` must be one of them). */
  areas: readonly AreaData[];
  /** Overrides for the yearly rates, e.g. `{ inflationAnnual: inflationAnnualOf(home) }`. */
  rates?: Partial<ForecastRates>;
  /** Net worth in today's dollars (default true). */
  todaysDollars?: boolean;
};

const BEDROOMS = [0, 1, 2, 3, 4] as const;

function validate(events: readonly LifeEvent[], areas: readonly AreaData[]): void {
  const ids = new Set<string>();
  for (const e of events) {
    if (ids.has(e.id)) throw new RangeError(`Duplicate life event id: ${e.id}`);
    ids.add(e.id);
    if (!Number.isInteger(e.startYear) || e.startYear < 0 || e.startYear > LIFE_EVENTS_YEARS) {
      throw new RangeError(`Invalid life event startYear: ${e.startYear}`);
    }
    switch (e.kind) {
      case 'baby':
        break;
      case 'move':
        if (!areas.some((a) => a.zip === e.toZip)) throw new RangeError(`No area data for ZIP ${e.toZip}`);
        if (e.bedrooms !== undefined && !BEDROOMS.includes(e.bedrooms)) throw new RangeError(`Invalid bedrooms: ${e.bedrooms}`);
        break;
      case 'car':
        if (!Number.isFinite(e.price) || e.price <= 0) throw new RangeError(`Invalid car price: ${e.price}`);
        if (!Number.isFinite(e.downPayment) || e.downPayment < 0 || e.downPayment > e.price) {
          throw new RangeError(`Invalid car down payment: ${e.downPayment}`);
        }
        if (!Number.isFinite(e.apr) || e.apr < 0 || e.apr > 1) throw new RangeError(`Invalid car APR: ${e.apr}`);
        if (!Number.isInteger(e.termMonths) || e.termMonths < 1 || e.termMonths > 120) {
          throw new RangeError(`Invalid car loan term: ${e.termMonths}`);
        }
        break;
      case 'raise': {
        const v = e.change.by === 'amount' ? e.change.amount : e.change.rate;
        if (!Number.isFinite(v)) throw new RangeError('Invalid raise');
        if (e.change.by === 'rate' && e.change.rate <= -1) throw new RangeError(`Invalid raise rate: ${e.change.rate}`);
        break;
      }
      case 'purchase':
        if (!Number.isFinite(e.amount) || e.amount < 0) throw new RangeError(`Invalid purchase amount: ${e.amount}`);
        break;
      default: {
        const never: never = e;
        throw new RangeError(`Unknown life event kind: ${(never as { kind: string }).kind}`);
      }
    }
  }
}

const startMonthOf = (e: LifeEvent): number => e.startYear * 12;
const sum = (lines: readonly LifeEventLine[]): Money => lines.reduce((s, l) => s + l.monthly, 0);

/** The NDCP age group of a child `ageMonths` old. */
export function kidAgeAt(ageMonths: number): KidAge {
  const b = kidAgeBandStartMonths.value;
  if (ageMonths >= b.schoolAge) return 'schoolAge';
  if (ageMonths >= b.preschool) return 'preschool';
  if (ageMonths >= b.toddler) return 'toddler';
  return 'infant';
}

/** A child's monthly costs at `ageMonths`, priced in `area` (childcare left out when the area has no price). */
function babyLines(area: AreaData | null, ageMonths: number): LifeEventLine[] {
  const lines: LifeEventLine[] = [];
  const childcare = area?.childcareMonthly;
  if (childcare) {
    lines.push({ item: 'childcare', monthly: childcare[kidAgeAt(ageMonths)], source: childcare.source, isEstimate: false });
  }
  if (area) {
    const g = area.groceriesPerAdult;
    lines.push({
      item: 'kidGroceries', monthly: kidGroceryFactor.value * g.value, source: g.source, isEstimate: true,
    });
  }
  lines.push({ item: 'kidOther', monthly: otherPerKidMonthly.value, source: assumptionSource, isEstimate: true });
  return lines;
}

/** Running costs of one car in `area`: insurance and fuel (none without area data). */
function carRunningLines(area: AreaData | null): LifeEventLine[] {
  if (!area) return [];
  const ins = area.carInsuranceMonthly;
  const gas = area.gasPerGallon;
  return [
    { item: 'carInsurance', monthly: ins.value, source: ins.source, isEstimate: ins.isEstimate ?? false },
    { item: 'fuel', monthly: gas.value * monthlyGallons.value, source: gas.source, isEstimate: true },
  ];
}

/** Changes to your own costs when you live in `to` instead of `home`. */
function moveLines(p: Profile, home: AreaData | null, to: AreaData, bedrooms: 0 | 1 | 2 | 3 | 4): LifeEventLine[] {
  const rentThere = to.rentByBedrooms[bedrooms];
  const yourRent = p.spending.rentUtilities;
  if (!home) {
    return [{ item: 'rent', monthly: rentThere.value - yourRent.value, source: rentThere.source, isEstimate: true }];
  }
  const lines: LifeEventLine[] = [];
  const rentHere = home.rentByBedrooms[bedrooms];
  if (rentHere.value > 0) {
    lines.push({
      item: 'rent', monthly: yourRent.value * (rentThere.value / rentHere.value - 1), source: rentThere.source,
      isEstimate: yourRent.isEstimate || (rentThere.isEstimate ?? false) || (rentHere.isEstimate ?? false),
    });
  }
  const groceries = p.spending.groceries;
  if (groceries.value > 0 && home.groceriesPerAdult.value > 0) {
    lines.push({
      item: 'groceries', monthly: groceries.value * (to.groceriesPerAdult.value / home.groceriesPerAdult.value - 1),
      source: to.groceriesPerAdult.source, isEstimate: groceries.isEstimate || (to.groceriesPerAdult.isEstimate ?? false),
    });
  }
  const childcare = p.spending.childcare;
  if (childcare.value > 0 && home.childcareMonthly && to.childcareMonthly && home.childcareMonthly.preschool > 0) {
    lines.push({
      item: 'childcareNow', monthly: childcare.value * (to.childcareMonthly.preschool / home.childcareMonthly.preschool - 1),
      source: to.childcareMonthly.source, isEstimate: childcare.isEstimate,
    });
  }
  if (p.spending.car.value > 0) {
    const ins = to.carInsuranceMonthly;
    lines.push({
      item: 'carInsurance', monthly: ins.value - home.carInsuranceMonthly.value, source: ins.source,
      isEstimate: (ins.isEstimate ?? false) || (home.carInsuranceMonthly.isEstimate ?? false),
    });
    lines.push({
      item: 'fuel', monthly: (to.gasPerGallon.value - home.gasPerGallon.value) * monthlyGallons.value,
      source: to.gasPerGallon.source, isEstimate: true,
    });
  }
  return lines;
}

function carLoanLine(e: Extract<LifeEvent, { kind: 'car' }>): LifeEventLine {
  return {
    item: 'carLoan', monthly: amortizedPayment(e.price - e.downPayment, e.apr, e.termMonths),
    source: yourInputSource, isEstimate: false,
  };
}

function raiseMonthly(p: Profile, e: Extract<LifeEvent, { kind: 'raise' }>): Money {
  return e.change.by === 'amount' ? e.change.amount : e.change.rate * p.takeHomePay.value;
}

/** Everything an event set does, as inputs to the simulation (see the header for the rules). */
function scheduleOf(
  p: Profile, events: readonly LifeEvent[], opts: LifeEventsOptions, months: number, inflationAnnual: number,
): { adjust: MonthlyAdjust; extra: ScheduledPurchase[]; areaAt: (t: number) => AreaData | null } {
  const byZip = new Map(opts.areas.map((a) => [a.zip, a]));
  // Latest move started by month t; ties go to the later one in the list.
  const moves = events
    .filter((e): e is Extract<LifeEvent, { kind: 'move' }> => e.kind === 'move')
    .map((e, i) => ({ e, i, start: startMonthOf(e), to: byZip.get(e.toZip)! }))
    .sort((a, b) => a.start - b.start || a.i - b.i);
  const moveAt = (t: number) => {
    let found: (typeof moves)[number] | undefined;
    for (const m of moves) if (m.start <= t) found = m;
    return found;
  };
  const areaAt = (t: number): AreaData | null => moveAt(t)?.to ?? opts.home;

  const spending: Money[] = [];
  const income: Money[] = [];
  for (let t = 0; t < months; t++) {
    let s = 0;
    let inc = 0;
    const area = areaAt(t);
    const move = moveAt(t);
    if (move) s += sum(moveLines(p, opts.home, move.to, move.e.bedrooms ?? lifeEventBedroomsDefault.value));
    for (const e of events) {
      const start = startMonthOf(e);
      if (start > t) continue;
      if (e.kind === 'baby') s += sum(babyLines(area, t - start));
      else if (e.kind === 'car') s += sum(carRunningLines(area));
      else if (e.kind === 'raise') inc += raiseMonthly(p, e);
    }
    spending.push(s);
    income.push(inc);
  }

  const extra: ScheduledPurchase[] = [];
  for (const e of events) {
    const startMonth = startMonthOf(e);
    const f = (1 + inflationAnnual) ** (startMonth / 12); // today's dollars → dollars of the start month
    if (e.kind === 'car') {
      extra.push({
        label: e.id, amount: e.price * f, recurring: false, startMonth,
        payWith: { loan: { amount: e.price * f, downPayment: e.downPayment * f, apr: e.apr, termMonths: e.termMonths } },
      });
    } else if (e.kind === 'purchase' && e.amount > 0) {
      extra.push({ label: e.id, amount: e.amount * f, recurring: false, payWith: 'cash', startMonth });
    }
  }
  return { adjust: { income, spending }, extra, areaAt };
}

/**
 * The what-if timeline: net worth over 10 years without and with the life events (see the header for
 * the rules), the 10-year delta, and per event its monthly change when it starts (lines with sources)
 * and its 10-year effect on its own. Pure and deterministic; throws RangeError on invalid events.
 */
export function lifeEvents(p: Profile, events: readonly LifeEvent[], opts: LifeEventsOptions): LifeEventsResult {
  validate(events, opts.areas);
  const rates = resolveRates(opts.rates);
  const todaysDollars = opts.todaysDollars ?? true;
  const months = forecastMonths(LIFE_EVENTS_YEARS);
  const run = (set: readonly LifeEvent[]) => {
    const s = scheduleOf(p, set, opts, months, rates.inflationAnnual);
    return { f: forecast(p, LIFE_EVENTS_YEARS, { rates, todaysDollars, adjust: s.adjust, extra: s.extra }), areaAt: s.areaAt };
  };

  const base = forecast(p, LIFE_EVENTS_YEARS, { rates, todaysDollars });
  const all = run(events);

  const effects: LifeEventEffect[] = events.map((e) => {
    const startMonth = startMonthOf(e);
    const area = all.areaAt(startMonth);
    let lines: LifeEventLine[] = [];
    let oneOff: Money = 0;
    let missingChildcare: boolean | undefined;
    let toMetro: string | undefined;
    switch (e.kind) {
      case 'baby':
        lines = babyLines(area, 0);
        if (!area?.childcareMonthly) missingChildcare = true;
        break;
      case 'move': {
        const to = opts.areas.find((a) => a.zip === e.toZip)!;
        lines = moveLines(p, opts.home, to, e.bedrooms ?? lifeEventBedroomsDefault.value);
        toMetro = to.metro;
        break;
      }
      case 'car':
        lines = [carLoanLine(e), ...carRunningLines(area)];
        oneOff = e.downPayment;
        break;
      case 'raise':
        lines = [{
          item: 'takeHome', monthly: -raiseMonthly(p, e), source: yourInputSource,
          isEstimate: e.change.by === 'rate' && p.takeHomePay.isEstimate,
        }];
        break;
      case 'purchase':
        oneOff = e.amount;
        break;
    }
    const alone = run([e]).f;
    return {
      id: e.id, kind: e.kind, startYear: e.startYear, startMonth,
      monthly: sum(lines), oneOff, lines,
      isEstimate: lines.some((l) => l.isEstimate),
      effect10yAlone: alone.in10y.mid - base.in10y.mid,
      ...(missingChildcare && { missingChildcare }),
      ...(toMetro !== undefined && { toMetro }),
    };
  });

  return { base, with: all.f, delta: all.f.in10y.mid - base.in10y.mid, events: effects, todaysDollars };
}
