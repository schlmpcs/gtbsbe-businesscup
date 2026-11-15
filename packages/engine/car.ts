// S13 "Keep the car or …?": the person's current car against one alternative (lease, buy a new one on a
// loan, or live without a car), both run month by month through simulate() on the person's profile
// for 10 years, in today's dollars. Pure and deterministic; the web app only words the result.
//
// Rules (docs/ENGINEERING.md → Forecast for the simulation itself):
// - Both paths count the car as an asset: the `vehicle` group opens at the car's value and loses
//   vehicleDepreciationAnnual (−15%) a year (simulate's plan options). So net worth here is the
//   forecast's (cash + retirement + home − debts) plus the car.
// - Keep: the profile's auto debts are replaced by the car's own loan (balance, APR, payment as typed);
//   the car line of spending is the car's running costs.
// - Every alternative first trades the car in: its value minus the loan left (the equity) goes to cash
//   in month 0, or, when the loan is larger than the car's value, the gap is paid from cash in month 0.
//   The auto debts go.
//   · lease: the lease payment every month and the amount due at signing at the start of every term
//     (a new lease each term), both from cash and rising with prices; the car line = the lease's
//     running costs. No car asset.
//   · buy: the new car's price on a loan (down payment from cash, the rest amortized over the term at
//     the APR); the car asset opens at the price. The car line = its running costs.
//   · noCar: the car line = the monthly cost of getting around without one (transit, rides, rentals).
// - Cost per month "now" is the first month's outflow for the car: loan or lease payment, running
//   costs and, for a lease, the amount due at signing spread over the term. Keep also gives the cost
//   once its loan is paid off.
import type { Debt, Money, Profile, Rate } from '@lifeguessr/types';
import { amortizedPayment } from './loan/amortize';
import {
  forecastMonths,
  resolveRates,
  simulate,
  type ForecastRates,
  type ScheduledPurchase,
  type SimulateOptions,
} from './simulate';

/** The car the person drives today. Money is monthly except `value` and `loanBalance` (balances). */
export type CarNow = {
  /** What the car is worth today (its trade-in value). */
  value: Money;
  loanBalance: Money;
  /** Required loan payment, per month (ignored without a balance). */
  loanPayment: Money;
  loanApr: Rate;
  /** Insurance, fuel, upkeep, per month. */
  running: Money;
};

export type CarAlternative =
  | { kind: 'lease'; monthly: Money; termMonths: number; dueAtSigning: Money; running: Money }
  | { kind: 'buy'; price: Money; downPayment: Money; apr: Rate; termMonths: number; running: Money }
  | { kind: 'noCar'; monthly: Money };

export type CarAlternativeKind = CarAlternative['kind'];

/** One path's car cost in a month, split for a stacked bar. `total` = payment + running + signing. */
export type CarMonthlyCost = { payment: Money; running: Money; signing: Money; total: Money };

/** Net worth of both paths at the end of year `year` (0 = today), today's dollars. */
export type CarDecisionYear = { year: number; keep: Money; alternative: Money };

export type CarDecision = {
  years: CarDecisionYear[];
  keep: {
    netWorth: Money;
    costNow: CarMonthlyCost;
    /** Car cost per month once the loan is paid off (running costs only). */
    costAfterPayoff: CarMonthlyCost;
    /** Months until the car loan is paid off; 0 = no loan; null = not within the horizon. */
    payoffMonth: number | null;
  };
  alternative: {
    kind: CarAlternativeKind;
    netWorth: Money;
    costNow: CarMonthlyCost;
    /** Paid once in month 0 besides the trade-in: the down payment of a new car (0 otherwise). */
    upfront: Money;
    /** How many times a lease is signed within the horizon (0 for buy / noCar). */
    signings: number;
  };
  /** Car value − loan left: cash from the trade-in (negative = the gap paid to clear the loan). */
  tradeInEquity: Money;
  /** keep.netWorth − alternative.netWorth at the horizon (positive = keeping is ahead). */
  difference: Money;
  better: 'keep' | 'alternative';
  /** |difference| < CAR_DECISION_TIE. */
  isClose: boolean;
  horizonYears: number;
};

export type CarDecisionOptions = { years?: number; rates?: Partial<ForecastRates> };

const KEEP_LOAN_ID = 'car-keep-loan';

/** Paths within this much at the horizon (today's dollars) are a tie: too close to call on estimates. */
export const CAR_DECISION_TIE: Money = 500;

function assertMoney(name: string, v: number): void {
  if (!Number.isFinite(v) || v < 0) throw new RangeError(`Invalid ${name}: ${v}`);
}
function assertRate(name: string, v: number): void {
  if (!Number.isFinite(v) || v < 0 || v >= 1) throw new RangeError(`Invalid ${name}: ${v}`);
}
function assertTerm(name: string, v: number): void {
  if (!Number.isInteger(v) || v < 1 || v > 120) throw new RangeError(`Invalid ${name}: ${v}`);
}

function validate(car: CarNow, alt: CarAlternative): void {
  assertMoney('car value', car.value);
  assertMoney('loan balance', car.loanBalance);
  assertMoney('loan payment', car.loanPayment);
  assertRate('loan APR', car.loanApr);
  assertMoney('running costs', car.running);
  if (alt.kind === 'lease') {
    assertMoney('lease payment', alt.monthly);
    assertTerm('lease term', alt.termMonths);
    assertMoney('due at signing', alt.dueAtSigning);
    assertMoney('lease running costs', alt.running);
  } else if (alt.kind === 'buy') {
    assertMoney('price', alt.price);
    assertMoney('down payment', alt.downPayment);
    if (alt.downPayment > alt.price) throw new RangeError(`Down payment ${alt.downPayment} above price ${alt.price}`);
    assertRate('new loan APR', alt.apr);
    assertTerm('new loan term', alt.termMonths);
    assertMoney('new car running costs', alt.running);
  } else {
    assertMoney('cost without a car', alt.monthly);
  }
}

/** A loan payment that does not cover the first month's interest never pays the loan off. */
export function carLoanPaymentTooLow(car: Pick<CarNow, 'loanBalance' | 'loanPayment' | 'loanApr'>): boolean {
  return car.loanBalance > 0 && car.loanPayment <= car.loanBalance * (car.loanApr / 12);
}

const cost = (payment: Money, running: Money, signing = 0): CarMonthlyCost => ({
  payment, running, signing, total: payment + running + signing,
});

/** Keep the car or switch: both paths' net worth year by year, the gap at the horizon, cost per month. */
export function carDecision(p: Profile, car: CarNow, alt: CarAlternative, opts: CarDecisionOptions = {}): CarDecision {
  validate(car, alt);
  const horizonYears = opts.years ?? 10;
  const months = forecastMonths(horizonYears);
  const rates = resolveRates(opts.rates);
  const withoutAuto = p.debts.filter((d) => d.kind !== 'auto');

  // ----- keep
  const keepLoan: Debt[] =
    car.loanBalance > 0
      ? [{ id: KEEP_LOAN_ID, kind: 'auto', balance: car.loanBalance, apr: car.loanApr, minPayment: { value: car.loanPayment, isEstimate: false } }]
      : [];
  const keepProfile: Profile = {
    ...p,
    debts: [...withoutAuto, ...keepLoan],
    spending: { ...p.spending, car: { value: car.running, isEstimate: false } },
  };
  const keepRun = simulate(keepProfile, months, { rates, balances: { vehicle: car.value } });

  // ----- the alternative, after the trade-in
  const equity = car.value - car.loanBalance;
  const extra: ScheduledPurchase[] = [];
  const sim: SimulateOptions = { rates, balances: { vehicle: 0 } };
  if (equity > 0) sim.newAssets = [{ group: 'cash', month: 0, value: equity }];
  else if (equity < 0) extra.push({ label: 'Loan left after the trade-in', amount: -equity, recurring: false, payWith: 'cash' });

  let altRunning: Money;
  let altCost: CarMonthlyCost;
  let upfront = 0;
  let signings = 0;
  if (alt.kind === 'lease') {
    altRunning = alt.running;
    extra.push({ label: 'Lease payment', amount: alt.monthly, recurring: 'monthly', payWith: 'cash' });
    for (let start = 0; start < months; start += alt.termMonths) {
      extra.push({ label: 'Due at signing', amount: alt.dueAtSigning, recurring: false, payWith: 'cash', startMonth: start });
      signings++;
    }
    altCost = cost(alt.monthly, alt.running, alt.dueAtSigning / alt.termMonths);
  } else if (alt.kind === 'buy') {
    altRunning = alt.running;
    upfront = alt.downPayment;
    sim.balances = { vehicle: alt.price };
    extra.push({
      label: 'New car',
      amount: alt.price,
      recurring: false,
      payWith: { loan: { amount: alt.price, apr: alt.apr, termMonths: alt.termMonths, downPayment: alt.downPayment } },
    });
    altCost = cost(amortizedPayment(alt.price - alt.downPayment, alt.apr, alt.termMonths), alt.running);
  } else {
    altRunning = alt.monthly;
    altCost = cost(0, alt.monthly);
  }
  const altProfile: Profile = {
    ...p,
    debts: withoutAuto,
    spending: { ...p.spending, car: { value: altRunning, isEstimate: false } },
  };
  const altRun = simulate(altProfile, months, { ...sim, extra });

  // ----- year by year, today's dollars
  const deflate = (v: Money, month: number) => v / (1 + rates.inflationAnnual) ** (month / 12);
  const years: CarDecisionYear[] = [];
  for (let y = 0; y <= horizonYears; y++) {
    const m = Math.min(y * 12, months);
    years.push({ year: y, keep: deflate(keepRun.path[m]!.netWorth, m), alternative: deflate(altRun.path[m]!.netWorth, m) });
  }
  // Today the two paths hold the same wealth in a different form (a car, or the cash it trades in for):
  // both lines start at today's net worth with the car.
  years[0] = { ...years[0]!, alternative: years[0]!.keep };
  const last = years[years.length - 1]!;
  const difference = last.keep - last.alternative;
  const payoffMonth = keepLoan.length === 0 ? 0 : (keepRun.payoffMonth[KEEP_LOAN_ID] ?? null);

  return {
    years,
    keep: {
      netWorth: last.keep,
      costNow: cost(keepLoan.length > 0 ? car.loanPayment : 0, car.running),
      costAfterPayoff: cost(0, car.running),
      payoffMonth,
    },
    alternative: { kind: alt.kind, netWorth: last.alternative, costNow: altCost, upfront, signings },
    tradeInEquity: equity,
    difference,
    better: difference >= 0 ? 'keep' : 'alternative',
    isClose: Math.abs(difference) < CAR_DECISION_TIE,
    horizonYears,
  };
}
