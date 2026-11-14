// Y1 (Amir): cost of a life card. Spec: docs/ENGINEERING.md → Cost of a life card.
import {
  COST_CATEGORIES,
  type AreaData, type CostBreakdown, type CostCategory, type Debt, type Estimate, type HouseholdFacts, type LifeCard,
  type Money, type Profile, type Rate, type Source,
} from '@lifeguessr/types';
import {
  type Assumption,
  ageDefault,
  assumptionSource,
  avgMealPrice,
  cashBufferMonthsDefault,
  eatingOutPerWeekDefault,
  estimateSpread,
  kidGroceryFactor,
  lifeCardLoanSource,
  monthlyGallons,
  otherPerAdultMonthly,
  otherPerKidMonthly,
  retirementBalanceDefault,
  retirementShareDefault,
  subscriptionsMonthlyDefault,
  takeHomePayDefault,
  weeksPerMonth,
} from './assumptions';

/** What each cost line is, so `cardToProfile` can route the car loan to `debts` (internal only). */
type LineRole =
  | 'rent' | 'carLoan' | 'carInsurance' | 'carFuel' | 'childcare'
  | 'groceriesAdults' | 'groceriesKids' | 'eatingOut';

type CostLine = CostBreakdown['items'][number] & { role: LineRole };

/** True when a value rests on an assumption rather than a published source. */
const isAssumed = (a: Assumption<unknown>): boolean => a.assumption === true;

/** The source to show for a line built on an assumption: its own source once it has one. */
const sourceOfAssumption = (a: Assumption<unknown>): Source => a.source ?? assumptionSource;

/** Monthly payment of a fully amortizing loan: P·r / (1 − (1 + r)^−n), or P / n at 0% APR. */
function amortizedMonthlyPayment(principal: Money, apr: Rate, termMonths: number): Money {
  if (principal <= 0) return 0;
  const r = apr / 12;
  return r === 0 ? principal / termMonths : (principal * r) / (1 - (1 + r) ** -termMonths);
}

/** The card's car loan: financed principal and monthly payment, or null when nothing is financed. */
function carLoanOf(card: LifeCard): { principal: Money; payment: Money; apr: Rate } | null {
  if (!card.car) return null;
  const principal = card.car.price - card.car.downPayment;
  if (principal <= 0) return null;
  return {
    principal,
    payment: amortizedMonthlyPayment(principal, card.car.apr, card.car.termMonths),
    apr: card.car.apr,
  };
}

/**
 * Every monthly cost line of a card, in display order. Lines whose inputs differ in source or in
 * estimate status are kept apart (car loan / insurance / fuel, adults' / kids' groceries), so each
 * line carries one honest source and the range spreads only the estimated parts.
 */
function costLines(card: LifeCard, area: AreaData): CostLine[] {
  const lines: CostLine[] = [];

  // HUD FMR is already gross rent (rent + utilities): no utilities added.
  const rent = area.rentByBedrooms[card.bedrooms];
  lines.push({
    role: 'rent', category: 'rentUtilities', amount: rent.value,
    source: rent.source, isEstimate: rent.isEstimate ?? false,
  });

  if (card.car) {
    const loan = carLoanOf(card);
    if (loan) {
      lines.push({
        role: 'carLoan', category: 'car', amount: loan.payment,
        source: lifeCardLoanSource, isEstimate: false,
      });
    }
    const insurance = area.carInsuranceMonthly;
    lines.push({
      role: 'carInsurance', category: 'car', amount: insurance.value,
      source: insurance.source, isEstimate: insurance.isEstimate ?? false,
    });
    const gas = area.gasPerGallon;
    lines.push({
      role: 'carFuel', category: 'car', amount: gas.value * monthlyGallons.value,
      source: gas.source, isEstimate: (gas.isEstimate ?? false) || isAssumed(monthlyGallons),
    });
  }

  if (card.kids.length > 0) {
    const childcare = area.childcareMonthly;
    if (!childcare) {
      throw new Error(`AreaData for ZIP ${area.zip} has no childcareMonthly, but card ${card.id} has kids`);
    }
    lines.push({
      role: 'childcare', category: 'childcare',
      amount: card.kids.reduce((sum, kid) => sum + childcare[kid], 0),
      source: childcare.source, isEstimate: false,
    });
  }

  const groceries = area.groceriesPerAdult;
  lines.push({
    role: 'groceriesAdults', category: 'groceries', amount: groceries.value * card.adults,
    source: groceries.source, isEstimate: groceries.isEstimate ?? false,
  });
  if (card.kids.length > 0) {
    lines.push({
      role: 'groceriesKids', category: 'groceries',
      amount: kidGroceryFactor.value * groceries.value * card.kids.length,
      source: groceries.source,
      isEstimate: (groceries.isEstimate ?? false) || isAssumed(kidGroceryFactor),
    });
  }

  // weeksPerMonth is a calendar conversion (52/12), not an input estimate.
  lines.push({
    role: 'eatingOut', category: 'eatingOut',
    amount: card.eatingOutPerWeek * weeksPerMonth.value * avgMealPrice.value,
    source: sourceOfAssumption(avgMealPrice), isEstimate: isAssumed(avgMealPrice),
  });

  return lines.filter((line) => line.amount > 0);
}

/** Low/high bounds of one line: rent by the ZCTA ratio (fallback ±spread), estimates ±spread. */
function lineRange(line: CostLine, area: AreaData): { low: Money; high: Money } {
  const spread = estimateSpread.value;
  if (line.role === 'rent') {
    const ratio = area.rentRangeRatio;
    return ratio
      ? { low: line.amount * ratio.low, high: line.amount * ratio.high }
      : { low: line.amount * (1 - spread), high: line.amount * (1 + spread) };
  }
  if (line.isEstimate) return { low: line.amount * (1 - spread), high: line.amount * (1 + spread) };
  return { low: line.amount, high: line.amount };
}

/** Monthly cost of a life card in its area, with a low/mid/high range (low ≤ mid ≤ high). */
export function costOfLife(card: LifeCard, area: AreaData): CostBreakdown {
  const lines = costLines(card, area);
  let low = 0;
  let mid = 0;
  let high = 0;
  for (const line of lines) {
    const range = lineRange(line, area);
    low += range.low;
    mid += line.amount;
    high += range.high;
  }
  return {
    total: { low: Math.min(low, mid), mid, high: Math.max(high, mid) },
    items: lines.map(({ category, amount, source, isEstimate }) => ({ category, amount, source, isEstimate })),
  };
}

/**
 * Closest Life: a life card as a Profile (car loan → `auto` debt; every field `isEstimate: true`).
 * `spending` holds the card's cost lines by category, with `car` = insurance + fuel only (the loan
 * payment lives in `debts`) and `debtPayments` = 0 (informational, measured from statements only).
 * Fields a card lacks (age, pay, balances, subscriptions, other) come from named assumptions: pay is
 * the sourced national default (`takeHomePayDefault`), never derived from the card's spending.
 */
export function cardToProfile(card: LifeCard, area: AreaData): Profile {
  const est = <T>(value: T): Estimate<T> => ({ value, isEstimate: true });

  const byCategory = Object.fromEntries(COST_CATEGORIES.map((c) => [c, 0])) as Record<CostCategory, Money>;
  for (const line of costLines(card, area)) {
    if (line.role !== 'carLoan') byCategory[line.category] += line.amount;
  }
  byCategory.subscriptions = subscriptionsMonthlyDefault.value;
  byCategory.other = otherPerAdultMonthly.value * card.adults + otherPerKidMonthly.value * card.kids.length;
  byCategory.debtPayments = 0;

  const debts: Debt[] = [];
  const loan = carLoanOf(card);
  if (loan) {
    debts.push({
      id: 'auto-1', kind: 'auto', balance: loan.principal, apr: loan.apr,
      minPayment: est(loan.payment),
    });
  }

  const spendingTotal = COST_CATEGORIES
    .filter((c) => c !== 'debtPayments')
    .reduce((sum, c) => sum + byCategory[c], 0);
  const monthlyOutflow = spendingTotal + debts.reduce((sum, d) => sum + d.minPayment.value, 0);

  return {
    age: est(ageDefault.value),
    takeHomePay: est(takeHomePayDefault.value),
    spending: Object.fromEntries(
      COST_CATEGORIES.map((c) => [c, est(byCategory[c])]),
    ) as Record<CostCategory, Estimate<Money>>,
    cash: est(monthlyOutflow * cashBufferMonthsDefault.value),
    retirement: est(retirementBalanceDefault.value),
    retirementShare: est(retirementShareDefault.value),
    debts,
    zip: card.zip,
    doneMoveIds: [],
  };
}

/** The id of the life built from the person's own "About you" answers (S6). */
export const OWN_LIFE_CARD_ID = 'own';

/**
 * "About you" → a life card for `costOfLife` / `cardToProfile`: the person's household in `area`. A car
 * is counted with insurance and fuel only (price 0: no loan we don't know about); eating out uses
 * `eatingOutPerWeekDefault`. `caption` is left empty: the screen labels this life itself.
 */
export function lifeCardFromFacts(facts: HouseholdFacts, area: AreaData): LifeCard {
  return {
    id: OWN_LIFE_CARD_ID,
    zip: area.zip,
    metro: area.metro,
    adults: facts.adults,
    kids: [...facts.kids],
    bedrooms: facts.bedrooms,
    ...(facts.hasCar ? { car: { price: 0, downPayment: 0, apr: 0, termMonths: 1 } } : {}),
    eatingOutPerWeek: eatingOutPerWeekDefault.value,
    caption: '',
  };
}

/**
 * Spending scaled so its categories (all but the informational `debtPayments`) add up to `total`,
 * each in proportion to its current amount. Used to turn a sample life into "my guess" (S5) with one
 * tap. Every scaled value is an estimate (the split is still the sample's). `total` ≤ 0 → all zero;
 * spending that is all zero stays zero.
 */
export function scaleSpendingTo(
  spending: Record<CostCategory, Estimate<Money>>,
  total: Money,
): Record<CostCategory, Estimate<Money>> {
  const scaled = COST_CATEGORIES.filter((c) => c !== 'debtPayments');
  const current = scaled.reduce((sum, c) => sum + spending[c].value, 0);
  const factor = current > 0 ? Math.max(0, total) / current : 0;
  const out = { ...spending };
  for (const c of scaled) out[c] = { value: spending[c].value * factor, isEstimate: true };
  return out;
}
