// Plan events (MP4, #164): one-tap defaults from area data, expansion into simulate() primitives, and
// the payment breakdowns the event panel shows.
//
// Dates: an event dated `year` starts in January of that year, or in `asOf` when the year is the
// current one (or earlier: simulate() clamps anything before month 0). An `endYear` ends it the same way.
// Amounts are today's dollars, like every LifeEvent; simulate() inflates them.
//
// Stacking: pay and spending LifeEvents SET a value, they don't add to it. So an event that builds on
// today's pay or a spending line (Income adds to pay, Have a kid adds to childcare and other, Buy a home
// with replaceHousing: false adds to the housing line, Career break restores the pay before it) reads
// that value as in effect at the event's start month: `ctx.profile`'s value with `ctx.profile.events`
// applied (those starting in or before that month, in simulate()'s order). To stack plan events on
// each other, expand them in date order and add each result's `lifeEvents` to `ctx.profile.events`
// before expanding the next. Each "back to" at the end of an event reads the profile the same way,
// at the end month, without the event itself.
import type {
  BuyHomeBreakdown, CostCategory, Debt, Estimate, ExpandedEvent, ExpenseFinancingBreakdown, LifeEvent, Money,
  PlanEvent, PlanEventContext, PlanEventOf, PlanEventType, Source, YearMonth,
} from '@lifeguessr/types';
import {
  assumptionSource, childcareMonthlyFallback, homeInsuranceMonthlyFallback, kidOtherMonthly, mortgageRateAnnual,
  planEventDefaults, socialSecurityClaimAge, socialSecurityShareOfTakeHome, utilitiesMonthlyAverage,
} from './assumptions';
import { addMonths, eventStartMonth } from './events';
import { amortizedPayment } from './loan/amortize';

type SpendingCategory = Exclude<CostCategory, 'debtPayments'>;

/**
 * The month an event dated `year` starts: `${year}-01`, or `asOf` when `year` is the current year or
 * earlier. ExpandedEvent.debts carry no month: each debt starts in this month of its event's `year`.
 */
export function planEventMonth(year: number, asOf: YearMonth): YearMonth {
  eventStartMonth(asOf, asOf); // RangeError for an invalid asOf
  if (!Number.isInteger(year)) throw new RangeError(`Invalid event year: ${year}`);
  return year <= Number(asOf.slice(0, 4)) ? asOf : `${String(year).padStart(4, '0')}-01`;
}

/** The profile's events with their start months, earliest first; ties keep list order (as simulate() applies them). */
function scheduled(ctx: PlanEventContext): { start: number; event: LifeEvent }[] {
  return (ctx.profile.events ?? [])
    .map((event) => ({ start: eventStartMonth(ctx.asOf, event.month), event }))
    .sort((a, b) => a.start - b.start);
}

/** Take-home pay in effect at `month`: the profile's, after its own pay events starting in or before it. */
function payAt(ctx: PlanEventContext, month: YearMonth): Estimate<Money> {
  const at = eventStartMonth(ctx.asOf, month);
  let pay = ctx.profile.takeHomePay;
  for (const { start, event } of scheduled(ctx)) {
    if (start <= at && event.kind === 'pay') pay = event.takeHomePay;
  }
  return { value: pay.value, isEstimate: pay.isEstimate };
}

/** A spending line in effect at `month`: the profile's, after its own events for that category starting in or before it. */
function spendingAt(ctx: PlanEventContext, category: SpendingCategory, month: YearMonth): Estimate<Money> {
  const at = eventStartMonth(ctx.asOf, month);
  let line = ctx.profile.spending[category];
  for (const { start, event } of scheduled(ctx)) {
    if (start <= at && event.kind === 'spending' && event.category === category) line = event.monthly;
  }
  return { value: line.value, isEstimate: line.isEstimate };
}

const plus = (base: Estimate<Money>, add: Money, addIsEstimate = false): Estimate<Money> =>
  ({ value: base.value + add, isEstimate: base.isEstimate || addIsEstimate });

const pay = (id: string, month: YearMonth, takeHomePay: Estimate<Money>): LifeEvent =>
  ({ id, month, kind: 'pay', takeHomePay });
const spending = (id: string, month: YearMonth, category: SpendingCategory, monthly: Estimate<Money>): LifeEvent =>
  ({ id, month, kind: 'spending', category, monthly });
/** A one-off of `amount`, or nothing when it is 0 (a LifeEvent one-off must be > 0). */
const oneOff = (id: string, month: YearMonth, amount: Money, direction: 'cost' | 'income'): LifeEvent[] =>
  amount > 0 ? [{ id, month, kind: 'oneOff', amount, direction }] : [];

const NOTHING = (): ExpandedEvent => ({ lifeEvents: [], debts: [], assets: [] });

// ----- breakdowns ------------------------------------------------------------------------------

/** Monthly cost of a home purchase: principal and interest, property tax, insurance, total. Upkeep is not part of it. */
export function buyHomeBreakdown(event: PlanEventOf<'buyHome'>): BuyHomeBreakdown {
  const financed = event.payCash ? 0 : Math.max(0, event.homeValue - event.downPayment);
  const principalAndInterest = amortizedPayment(financed, event.rate, event.termYears * 12);
  const propertyTax = (event.homeValue * event.propertyTaxRate) / 12;
  const insurance = event.insuranceMonthly.value;
  return { principalAndInterest, propertyTax, insurance, total: principalAndInterest + propertyTax + insurance };
}

/**
 * The loan behind a financed expense; null when the event has no `financing`, or is monthly
 * (financing applies to a one-time expense only). A down payment above the amount finances nothing.
 */
export function expenseFinancingBreakdown(event: PlanEventOf<'expense'>): ExpenseFinancingBreakdown | null {
  const f = event.financing;
  if (!f || event.cadence !== 'once') return null;
  const downPayment = Math.min(f.downPayment, event.amount);
  const financed = event.amount - downPayment;
  const monthlyPayment = amortizedPayment(financed, f.apr, f.termMonths);
  // A level payment that clears the loan in exactly termMonths: interest = payments − principal.
  const totalInterest = financed === 0 ? 0 : monthlyPayment * f.termMonths - financed;
  return { downPayment, financed, monthlyPayment, totalInterest };
}

// ----- expandEvent -----------------------------------------------------------------------------

/**
 * A macro event as LifeEvents, new Debts and assets (see the header for dates and stacking).
 * A disabled event expands to nothing, and so does one whose end is not after its start.
 */
export function expandEvent(event: PlanEvent, ctx: PlanEventContext): ExpandedEvent {
  if (!event.enabled) return NOTHING();
  const id = event.id;
  const start = planEventMonth(event.year, ctx.asOf);
  const startIndex = eventStartMonth(ctx.asOf, start);
  /** The end month of an `endYear`, or null when there is none; undefined when it is not after the start. */
  const endOf = (endYear: number | undefined): YearMonth | null | undefined => {
    if (endYear === undefined) return null;
    const end = planEventMonth(endYear, ctx.asOf);
    return eventStartMonth(ctx.asOf, end) > startIndex ? end : undefined;
  };

  switch (event.type) {
    case 'income': {
      const end = endOf(event.endYear);
      if (end === undefined) return NOTHING();
      return {
        lifeEvents: [
          pay(`${id}:pay`, start, plus(payAt(ctx, start), event.monthly)),
          ...(end ? [pay(`${id}:pay-end`, end, payAt(ctx, end))] : []),
        ],
        debts: [],
        assets: [],
      };
    }
    case 'expense': {
      if (event.cadence === 'monthly') {
        const end = endOf(event.endYear);
        if (end === undefined) return NOTHING();
        return {
          lifeEvents: [
            spending(`${id}:other`, start, 'other', plus(spendingAt(ctx, 'other', start), event.amount)),
            ...(end ? [spending(`${id}:other-end`, end, 'other', spendingAt(ctx, 'other', end))] : []),
          ],
          debts: [],
          assets: [],
        };
      }
      const loan = expenseFinancingBreakdown(event);
      if (!loan) return { lifeEvents: oneOff(`${id}:cost`, start, event.amount, 'cost'), debts: [], assets: [] };
      return {
        lifeEvents: oneOff(`${id}:cost`, start, loan.downPayment, 'cost'),
        debts: loan.financed > 0
          ? [{ id: `${id}:loan`, kind: 'personal', balance: loan.financed, apr: event.financing!.apr,
              minPayment: { value: loan.monthlyPayment, isEstimate: false } }]
          : [],
        assets: [],
      };
    }
    case 'buyHome': {
      const b = buyHomeBreakdown(event);
      const financed = event.payCash ? 0 : Math.max(0, event.homeValue - event.downPayment);
      const housing = spendingAt(ctx, 'rentUtilities', start);
      // Owner costs: tax + insurance + upkeep + the utilities part of today's housing line.
      const utilities = Math.min(housing.value, utilitiesMonthlyAverage.value);
      const owner = b.propertyTax + b.insurance + (event.homeValue * event.upkeepRate) / 12 + utilities;
      const line: Estimate<Money> = event.replaceHousing
        ? { value: owner, isEstimate: true }       // utilities are a national average
        : { value: housing.value + owner, isEstimate: true };
      const debts: Debt[] = financed > 0
        ? [{ id: `${id}:mortgage`, kind: 'mortgage', balance: financed, apr: event.rate,
            minPayment: { value: b.principalAndInterest, isEstimate: false } }]
        : [];
      return {
        lifeEvents: [
          ...oneOff(`${id}:down`, start, event.payCash ? event.homeValue : Math.min(event.downPayment, event.homeValue), 'cost'),
          spending(`${id}:housing`, start, 'rentUtilities', line),
        ],
        debts,
        assets: [{ group: 'realEstate', month: startIndex, value: event.homeValue }],
      };
    }
    case 'haveKid': {
      const lifeEvents: LifeEvent[] = [];
      if (event.childcareYears > 0) {
        const end = addMonths(start, event.childcareYears * 12);
        lifeEvents.push(
          spending(`${id}:childcare`, start, 'childcare',
            plus(spendingAt(ctx, 'childcare', start), event.childcareMonthly.value, event.childcareMonthly.isEstimate)),
          spending(`${id}:childcare-end`, end, 'childcare', spendingAt(ctx, 'childcare', end)),
        );
      }
      const otherEnd = addMonths(start, planEventDefaults.value.kidCostYears * 12);
      lifeEvents.push(
        spending(`${id}:other`, start, 'other',
          plus(spendingAt(ctx, 'other', start), event.otherMonthly.value, event.otherMonthly.isEstimate)),
        spending(`${id}:other-end`, otherEnd, 'other', spendingAt(ctx, 'other', otherEnd)),
      );
      return { lifeEvents, debts: [], assets: [] };
    }
    case 'newJob':
      return { lifeEvents: [pay(`${id}:pay`, start, { value: event.takeHomePay, isEstimate: false })], debts: [], assets: [] };
    case 'careerBreak': {
      const end = endOf(event.endYear);
      if (!end) return NOTHING();
      return {
        lifeEvents: [
          pay(`${id}:pay`, start, { value: 0, isEstimate: false }),
          pay(`${id}:pay-end`, end, payAt(ctx, start)), // the pay in effect when the break started
        ],
        debts: [],
        assets: [],
      };
    }
    case 'windfall':
      return { lifeEvents: oneOff(`${id}:income`, start, event.amount, 'income'), debts: [], assets: [] };
    case 'retire':
      return { lifeEvents: [pay(`${id}:pay`, start, { value: 0, isEstimate: false })], debts: [], assets: [] };
    case 'socialSecurity':
      // Sets take-home pay to the benefit: it adds to income only when it starts at or after the
      // retire event (pay already 0). Started before retirement it would replace the salary, and a
      // later Retire sets pay to 0 again; so expand Retire first, and keep its year ≤ this one.
      return { lifeEvents: [pay(`${id}:pay`, start, { ...event.monthly })], debts: [], assets: [] };
  }
}

// ----- defaultEvent ----------------------------------------------------------------------------

/** Where each amount of a default event comes from: the area data's Source, or an assumption's. */
export type DefaultEventSources = Partial<Record<string, Source>>;

function buildDefault(type: PlanEventType, ctx: PlanEventContext): { event: PlanEvent; sources: DefaultEventSources } {
  const d = planEventDefaults.value;
  const assumed = assumptionSource; // planEventDefaults is an assumption with no published source
  eventStartMonth(ctx.asOf, ctx.asOf); // RangeError for an invalid asOf
  const asOfYear = Number(ctx.asOf.slice(0, 4));
  const next = asOfYear + 1;
  const birthYear = asOfYear - Math.round(ctx.profile.age.value);
  const base = (year: number) => ({ id: `${type}-${year}`, year, enabled: true });
  const area = ctx.area;

  switch (type) {
    case 'income':
      return { event: { ...base(next), type, monthly: d.incomeMonthly }, sources: { monthly: assumed } };
    case 'expense':
      return { event: { ...base(next), type, amount: d.expenseAmount, cadence: 'once' }, sources: { amount: assumed } };
    case 'buyHome': {
      const homeValue = area?.homeValueMedian?.value ?? d.homeValue;
      const insurance = area?.homeInsuranceMonthly ?? homeInsuranceMonthlyFallback;
      return {
        event: {
          ...base(next), type, homeValue, downPayment: homeValue * d.downPaymentShare, payCash: false,
          termYears: d.termYears, rate: mortgageRateAnnual.value,
          propertyTaxRate: area?.propertyTaxRate?.value ?? d.propertyTaxRate,
          insuranceMonthly: { value: insurance.value, isEstimate: true },
          upkeepRate: d.upkeepRate, replaceHousing: true,
        },
        sources: {
          homeValue: area?.homeValueMedian?.source ?? assumed,
          downPayment: assumed,
          termYears: assumed,
          rate: mortgageRateAnnual.source,
          propertyTaxRate: area?.propertyTaxRate?.source ?? assumed,
          insuranceMonthly: insurance.source,
          upkeepRate: assumed,
        },
      };
    }
    case 'haveKid': {
      const childcare = area?.childcareMonthly;
      return {
        event: {
          ...base(next), type,
          childcareMonthly: { value: childcare?.infant ?? childcareMonthlyFallback.value, isEstimate: true },
          childcareYears: d.childcareYears,
          otherMonthly: { value: kidOtherMonthly.value, isEstimate: true },
        },
        sources: {
          childcareMonthly: childcare?.source ?? childcareMonthlyFallback.source,
          childcareYears: assumed,
          otherMonthly: kidOtherMonthly.source,
        },
      };
    }
    case 'newJob':
      return {
        event: { ...base(next), type, takeHomePay: ctx.profile.takeHomePay.value * (1 + d.newJobRaise) },
        sources: { takeHomePay: assumed },
      };
    case 'careerBreak':
      return { event: { ...base(next), type, endYear: next + d.careerBreakYears }, sources: { endYear: assumed } };
    case 'windfall':
      return { event: { ...base(next), type, amount: d.windfallAmount }, sources: { amount: assumed } };
    case 'retire':
      return { event: { ...base(birthYear + ctx.assumptions.retireAge), type }, sources: {} };
    case 'socialSecurity':
      return {
        event: {
          ...base(birthYear + socialSecurityClaimAge.value), type,
          monthly: { value: ctx.profile.takeHomePay.value * socialSecurityShareOfTakeHome.value, isEstimate: true },
        },
        sources: { year: socialSecurityClaimAge.source, monthly: assumptionSource },
      };
  }
}

/**
 * What "Add event" creates in one tap. Values come from the area data where it has them (home value,
 * property tax, insurance, infant childcare) and from `assumptions.ts` otherwise; every amount is an
 * estimate the user can edit, and `defaultEventSources` names its source. Starts next year, except
 * Retire (birth year + retireAge) and Social Security (birth year + 67). The id is `${type}-${year}`:
 * the caller makes it unique within a scenario.
 */
export function defaultEvent<T extends PlanEventType>(type: T, ctx: PlanEventContext): PlanEventOf<T> {
  return buildDefault(type, ctx).event as PlanEventOf<T>;
}

/** The Source of each amount `defaultEvent(type, ctx)` fills in, keyed by field (assumption-only values: `assumptionSource`). */
export function defaultEventSources(type: PlanEventType, ctx: PlanEventContext): DefaultEventSources {
  return buildDefault(type, ctx).sources;
}
