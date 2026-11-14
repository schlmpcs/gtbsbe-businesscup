// Y2 (Amir): the month-by-month money simulation behind forecast() and, later, canAfford() (Y4)
// and rankMoves() (Y3). Spec: docs/ENGINEERING.md → Forecast.
//
// Conventions (all monthly; t = month index starting at 0, month m = t + 1 ends after step t):
// - The path has one entry per month end, index = month number. Entry 0 is today's balance sheet
//   (its flow fields are 0); entry m is the state at the end of month m.
// - Each month, in order:
//   1. cash grows at cashYield (only while positive), retirement at returnAnnualNominal, using the
//      effective monthly rate (1 + annual)^(1/12) − 1;
//   2. every debt with a balance accrues interest at apr / 12 (the loan engine's convention) and is
//      paid min(required + extraPayment, balance + interest); a paid-off debt's payment stops, so the
//      money it freed flows into the surplus from then on;
//   3. purchases due this month: cash ones are part of this month's outflow, card ones are added to
//      the card balance, loan ones add an amortizing debt whose first payment is next month;
//   4. surplus = income − spending − debt payments − cash purchases. Above 0: retirementShare of it
//      goes to retirement, the rest to cash. Below 0: drawn from cash; once cash would go below 0,
//      the shortfall is added to a card balance (see `cardTarget`).
// - income = takeHomePay × (1 + incomeGrowth)^(t/12); spending = Σ categories except debtPayments
//   × (1 + inflation)^(t/12). `spending.debtPayments` is informational: payments come from `debts`.
// - Purchases are consumption, not assets: nothing is added to net worth for the thing bought.
import type { AreaData, Debt, LoanInput, Money, Profile, Purchase, Rate } from '@lifeguessr/types';
import {
  cardAprDefault,
  cardMinPayment,
  cashYieldAnnual,
  estimateSpread,
  inflationAnnualFallback,
  minForecastMonths,
  returnAnnualNominal,
} from './assumptions';
import { MAX_SIMULATION_MONTHS, amortizedPayment } from './loan/index';

/** Balances below this many dollars count as paid off (absorbs floating-point dust). */
const PAID_OFF_EPSILON: Money = 1e-6;

/** Id of the card debt the simulation opens when it needs a card and the profile has none. */
export const SYNTHETIC_CARD_ID = 'card-synthetic';

/** Yearly rates the simulation uses. Defaults come from `assumptions.ts`. */
export type ForecastRates = {
  inflationAnnual: Rate;     // prices (spending) and the today's-dollars deflator
  incomeGrowthAnnual: Rate;  // take-home pay growth; defaults to inflationAnnual (real income flat)
  cashYieldAnnual: Rate;
  returnAnnualNominal: Rate; // retirement
  cardApr: Rate;             // APR of the synthetic card opened for shortfalls / card purchases
};

/**
 * A purchase plus when it first happens. `startMonth` is the 0-based month index of the first
 * occurrence (default 0 = this month); recurring purchases repeat every month / every 12 months from
 * there. A plain `Purchase` is a valid `ScheduledPurchase`.
 */
export type ScheduledPurchase = Purchase & { startMonth?: number };

/** Which inputs to use: point values (`mid`) or every estimate shifted against / in the user's favor. */
export type Scenario = 'low' | 'mid' | 'high';

export type SimulateOptions = {
  extra?: readonly ScheduledPurchase[];
  rates?: Partial<ForecastRates>;
  scenario?: Scenario;
};

/** State at the end of one month. Flows are for that month; balances are at its end. */
export type SimulationMonth = {
  month: number;
  income: Money;
  spending: Money;              // profile categories (not purchases)
  debtPayments: Money;          // everything paid on debts, extra payments included
  requiredDebtPayments: Money;  // minimum payments only (what debt load is measured on)
  purchasesCash: Money;         // cash paid for purchases (a loan purchase's unfinanced part)
  cardCharges: Money;           // purchases put on a card
  surplus: Money;               // income − spending − debtPayments − purchasesCash
  shortfallToCard: Money;       // the part of a negative surplus that cash could not cover
  cash: Money;
  retirement: Money;
  debtBalance: Money;           // Σ all debt balances
  cardBalance: Money;           // Σ balances of kind 'card' (the synthetic card included)
  debts: Record<string, Money>; // balance by debt id
  netWorth: Money;              // cash + retirement − debtBalance
  debtLoad: Rate;               // requiredDebtPayments / income (∞ when income is 0 and payments > 0)
};

export type Simulation = {
  rates: ForecastRates;
  /** Index m = end of month m; index 0 = today. Length = months + 1. */
  path: SimulationMonth[];
  /** First month each debt's balance reached 0 (0 = already paid off; null = not within the horizon). */
  payoffMonth: Record<string, number | null>;
};

/** Effective monthly rate for a yearly rate: (1 + annual)^(1/12) − 1. */
export function monthlyRate(annual: Rate): Rate {
  return (1 + annual) ** (1 / 12) - 1;
}

/** Inflation for an area: BLS CPI-U YoY from AreaData when there is one, else the fallback. */
export function inflationAnnualOf(area?: Pick<AreaData, 'cpiYoY'> | null): Rate {
  return area?.cpiYoY.value ?? inflationAnnualFallback.value;
}

/** Fills in the default rates; incomeGrowthAnnual defaults to the (possibly overridden) inflation. */
export function resolveRates(rates?: Partial<ForecastRates>): ForecastRates {
  const inflationAnnual = rates?.inflationAnnual ?? inflationAnnualFallback.value;
  const resolved: ForecastRates = {
    inflationAnnual,
    incomeGrowthAnnual: rates?.incomeGrowthAnnual ?? inflationAnnual,
    cashYieldAnnual: rates?.cashYieldAnnual ?? cashYieldAnnual.value,
    returnAnnualNominal: rates?.returnAnnualNominal ?? returnAnnualNominal.value,
    cardApr: rates?.cardApr ?? cardAprDefault.value,
  };
  for (const [name, value] of Object.entries(resolved)) {
    if (!Number.isFinite(value) || value <= -1) throw new RangeError(`Invalid ${name}: ${value}`);
  }
  return resolved;
}

/** Months a forecast of `years` simulates: max(minForecastMonths, ⌈years × 12⌉), capped at 100 years. */
export function forecastMonths(years: number): number {
  if (!Number.isFinite(years) || years < 0) throw new RangeError(`Invalid forecast years: ${years}`);
  const months = Math.max(minForecastMonths.value, Math.ceil(years * 12));
  if (months > MAX_SIMULATION_MONTHS) throw new RangeError(`Forecast too long: ${months} months`);
  return months;
}

/** Card minimum payment (cardMinPayment): this month's interest + 1% of the balance, floor $25. */
export function cardMinPaymentFor(balance: Money, apr: Rate): Money {
  if (balance <= 0) return 0;
  const f = cardMinPayment.value;
  const interest = f.includesInterest ? balance * (apr / 12) : 0;
  return Math.max(f.floor, interest + f.balanceShare * balance);
}

/**
 * Required monthly payment rule for a debt. A card whose minimum payment is an estimate (the user
 * skipped it) follows `cardMinPaymentFor` every month, so it shrinks with the balance like a real
 * issuer minimum; the stored value is only today's output of that formula. Every other debt pays
 * its stated `minPayment.value` until it is paid off.
 */
export function usesCardFormula(d: Pick<Debt, 'kind' | 'minPayment'>): boolean {
  return d.kind === 'card' && d.minPayment.isEstimate;
}

/** True when any input the simulation reads is an estimate (so the range band is not zero). */
export function hasEstimates(p: Profile): boolean {
  return (
    p.takeHomePay.isEstimate ||
    p.cash.isEstimate ||
    p.retirement.isEstimate ||
    p.retirementShare.isEstimate ||
    Object.entries(p.spending).some(([c, e]) => c !== 'debtPayments' && e.isEstimate) ||
    p.debts.some((d) => d.minPayment.isEstimate)
  );
}

/**
 * Shifts an estimated value by ±estimateSpread × |value|: in the user's favor for 'high', against
 * it for 'low'. Point values ('mid') and measured values pass through unchanged.
 */
function shift(value: number, isEstimate: boolean, scenario: Scenario, higherIsBetter: boolean): number {
  if (!isEstimate || scenario === 'mid') return value;
  const up = (scenario === 'high') === higherIsBetter;
  const delta = estimateSpread.value * Math.abs(value);
  return up ? value + delta : value - delta;
}

type DebtState = {
  id: string;
  kind: Debt['kind'];
  apr: Rate;
  balance: Money;
  fixedPayment: Money | null; // null = card formula
  paymentFactor: number;      // scenario shift of the required payment
  extra: Money;
  payoffMonth: number | null;
};

/** The loan a `{ loan }` purchase opens, the cash it costs at purchase, both scaled by `scale`. */
function financePurchase(amount: Money, l: LoanInput, scale: number): { cashOut: Money; principal: Money; payment: Money } {
  const loanAmount = l.amount * scale;
  const downPayment = (l.downPayment ?? 0) * scale;
  const fees = (l.fees ?? 0) * scale;
  const advanced = Math.max(0, loanAmount - downPayment); // what the lender pays toward the price
  const principal = advanced + fees;                       // fees are rolled into the loan
  return {
    cashOut: amount * scale - advanced, // < 0 only if the loan is larger than the price
    principal,
    payment: amortizedPayment(principal, l.apr, l.termMonths),
  };
}

function occursAt(x: ScheduledPurchase, t: number): boolean {
  const start = x.startMonth ?? 0;
  if (t < start) return false;
  if (x.recurring === false) return t === start;
  if (x.recurring === 'monthly') return true;
  return (t - start) % 12 === 0;
}

/**
 * Month-by-month simulation of a profile's cash, retirement and debts (see the header for the
 * rules). Pure: the profile and purchases are not mutated. `scenario` shifts every `isEstimate`
 * input by ±estimateSpread (income, cash, retirement up = favorable; spending down = favorable;
 * retirementShare up when retirement returns beat cash; an estimated debt payment up when the
 * debt's APR beats the cash yield).
 */
export function simulate(p: Profile, months: number, opts: SimulateOptions = {}): Simulation {
  if (!Number.isInteger(months) || months < 0 || months > MAX_SIMULATION_MONTHS) {
    throw new RangeError(`Invalid simulation length: ${months} months`);
  }
  const rates = resolveRates(opts.rates);
  const scenario = opts.scenario ?? 'mid';
  const extra = opts.extra ?? [];
  for (const x of extra) {
    const start = x.startMonth ?? 0;
    if (!Number.isInteger(start) || start < 0) throw new RangeError(`Invalid purchase startMonth: ${start}`);
  }

  const takeHome = shift(p.takeHomePay.value, p.takeHomePay.isEstimate, scenario, true);
  let monthlySpending = 0;
  for (const [category, e] of Object.entries(p.spending)) {
    if (category === 'debtPayments') continue;
    monthlySpending += shift(e.value, e.isEstimate, scenario, false);
  }
  const retirementBeatsCash = rates.returnAnnualNominal > rates.cashYieldAnnual;
  const retirementShare = Math.min(
    1,
    Math.max(0, shift(p.retirementShare.value, p.retirementShare.isEstimate, scenario, retirementBeatsCash)),
  );
  let cash = shift(p.cash.value, p.cash.isEstimate, scenario, true);
  let retirement = shift(p.retirement.value, p.retirement.isEstimate, scenario, true);

  const debts: DebtState[] = p.debts.map((d) => ({
    id: d.id,
    kind: d.kind,
    apr: d.apr,
    balance: d.balance,
    fixedPayment: usesCardFormula(d) ? null : d.minPayment.value,
    paymentFactor: shift(1, d.minPayment.isEstimate, scenario, d.apr > rates.cashYieldAnnual),
    extra: d.extraPayment ?? 0,
    payoffMonth: d.balance <= PAID_OFF_EPSILON ? 0 : null,
  }));
  const usedIds = new Set(debts.map((d) => d.id));
  const uniqueId = (base: string) => {
    let id = base;
    for (let i = 2; usedIds.has(id); i++) id = `${base}-${i}`;
    usedIds.add(id);
    return id;
  };

  // Shortfalls and card purchases go onto the first card in the profile; without one, a card at
  // the default APR is opened the first time it is needed (minimum payment by the card formula).
  let cardTarget: DebtState | undefined = debts.find((d) => d.kind === 'card');
  const chargeCard = (amount: Money) => {
    if (amount <= 0) return;
    if (!cardTarget) {
      cardTarget = {
        id: uniqueId(SYNTHETIC_CARD_ID),
        kind: 'card',
        apr: rates.cardApr,
        balance: 0,
        fixedPayment: null,
        paymentFactor: 1,
        extra: 0,
        payoffMonth: null,
      };
      debts.push(cardTarget);
    }
    cardTarget.balance += amount;
  };

  const rCash = monthlyRate(rates.cashYieldAnnual);
  const rRetirement = monthlyRate(rates.returnAnnualNominal);

  const snapshot = (month: number, flows: Omit<SimulationMonth, 'month' | 'cash' | 'retirement' | 'debtBalance' | 'cardBalance' | 'debts' | 'netWorth'>): SimulationMonth => {
    let debtBalance = 0;
    let cardBalance = 0;
    const byId: Record<string, Money> = {};
    for (const d of debts) {
      byId[d.id] = d.balance;
      debtBalance += d.balance;
      if (d.kind === 'card') cardBalance += d.balance;
    }
    return {
      month, ...flows, cash, retirement, debtBalance, cardBalance, debts: byId,
      netWorth: cash + retirement - debtBalance,
    };
  };

  const path: SimulationMonth[] = [
    snapshot(0, {
      income: 0, spending: 0, debtPayments: 0, requiredDebtPayments: 0, purchasesCash: 0,
      cardCharges: 0, surplus: 0, shortfallToCard: 0, debtLoad: 0,
    }),
  ];

  for (let t = 0; t < months; t++) {
    const month = t + 1;
    const priceFactor = (1 + rates.inflationAnnual) ** (t / 12);
    const income = takeHome * (1 + rates.incomeGrowthAnnual) ** (t / 12);
    const spending = monthlySpending * priceFactor;

    // 1. Growth on the opening balances.
    if (cash > 0) cash *= 1 + rCash;
    retirement *= 1 + rRetirement;

    // 2. Debts: interest, then the payment (never more than what is owed).
    let debtPayments = 0;
    let requiredDebtPayments = 0;
    for (const d of debts) {
      if (d.balance <= PAID_OFF_EPSILON) continue;
      const interest = d.balance * (d.apr / 12);
      const required = (d.fixedPayment ?? cardMinPaymentFor(d.balance, d.apr)) * d.paymentFactor;
      const owed = d.balance + interest;
      const payment = Math.min(required + d.extra, owed);
      debtPayments += payment;
      requiredDebtPayments += Math.min(required, owed);
      d.balance = owed - payment;
      if (d.balance <= PAID_OFF_EPSILON) {
        d.balance = 0;
        d.payoffMonth ??= month;
      }
    }

    // 3. Purchases due this month. Recurring prices rise with inflation from their first occurrence.
    let purchasesCash = 0;
    let cardCharges = 0;
    const newLoans: DebtState[] = [];
    for (const x of extra) {
      if (!occursAt(x, t)) continue;
      const scale = (1 + rates.inflationAnnual) ** ((t - (x.startMonth ?? 0)) / 12);
      if (x.payWith === 'cash') purchasesCash += x.amount * scale;
      else if (x.payWith === 'card') cardCharges += x.amount * scale;
      else {
        const f = financePurchase(x.amount, x.payWith.loan, scale);
        purchasesCash += f.cashOut;
        if (f.principal > PAID_OFF_EPSILON) {
          newLoans.push({
            id: uniqueId(`purchase-m${month}`),
            kind: 'personal',
            apr: x.payWith.loan.apr,
            balance: f.principal,
            fixedPayment: f.payment,
            paymentFactor: 1,
            extra: x.payWith.loan.extraPayment ?? 0,
            payoffMonth: null,
          });
        }
      }
    }
    debts.push(...newLoans);
    chargeCard(cardCharges);

    // 4. Surplus: split between retirement and cash, or drawn from cash and then a card.
    const surplus = income - spending - debtPayments - purchasesCash;
    if (surplus > 0) {
      const toRetirement = surplus * retirementShare;
      retirement += toRetirement;
      cash += surplus - toRetirement;
    } else {
      cash += surplus;
    }
    let shortfallToCard = 0;
    if (cash < 0) {
      shortfallToCard = -cash;
      cash = 0;
      chargeCard(shortfallToCard);
    }

    const debtLoad = income > 0 ? requiredDebtPayments / income : requiredDebtPayments > 0 ? Infinity : 0;
    path.push(snapshot(month, {
      income, spending, debtPayments, requiredDebtPayments, purchasesCash, cardCharges, surplus,
      shortfallToCard, debtLoad,
    }));
  }

  const payoffMonth: Record<string, number | null> = {};
  for (const d of debts) payoffMonth[d.id] = d.payoffMonth;
  return { rates, path, payoffMonth };
}
