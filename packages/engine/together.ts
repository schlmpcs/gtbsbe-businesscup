// "Together": a couple's household math (/together). Pure and deterministic, like the rest of the
// engine. The 10-year view and the shared goal reuse forecast() and goalStatus() on the profile
// combineProfiles() builds; this file only adds the household month and the bill split.
import type { CostCategory, Debt, Money, Profile, Rate, TogetherPartner } from '@lifeguessr/types';
import { COST_CATEGORIES, TOGETHER_DEBTS_MAX, TOGETHER_MONEY_MAX } from '@lifeguessr/types';
import { ageDefault } from './assumptions';

/** The bills a couple usually shares: housing (rent + utilities), groceries and childcare. */
export const SHARED_BILL_CATEGORIES = ['rentUtilities', 'groceries', 'childcare'] as const satisfies readonly CostCategory[];

const est = <T>(value: T, isEstimate: boolean) => ({ value, isEstimate });
const clampMoney = (v: Money, min = 0) => Math.min(TOGETHER_MONEY_MAX, Math.max(min, v));

/**
 * The part of a Profile a shared plan holds (TogetherPartnerSchema): pay, spending, cash,
 * retirement and debts. Age, ZIP, household facts and moves stay in the browser; debt ids are
 * replaced by `d1`, `d2`, …; extra payments (a move) are left out; amounts are clamped to the plan's
 * bounds and at most TOGETHER_DEBTS_MAX debts (the largest balances) are kept.
 */
export function partnerOfProfile(p: Profile, nickname?: string): TogetherPartner {
  const spending = {} as TogetherPartner['spending'];
  for (const c of COST_CATEGORIES) spending[c] = est(clampMoney(p.spending[c].value), p.spending[c].isEstimate);
  const debts = [...p.debts]
    .filter((d) => d.balance > 0)
    .sort((x, y) => y.balance - x.balance)
    .slice(0, TOGETHER_DEBTS_MAX)
    .map((d, i) => ({
      id: `d${i + 1}`,
      kind: d.kind,
      balance: clampMoney(d.balance),
      apr: d.apr,
      minPayment: est(clampMoney(d.minPayment.value), d.minPayment.isEstimate),
    }));
  const name = nickname?.trim();
  return {
    ...(name ? { nickname: name } : {}),
    takeHomePay: est(clampMoney(p.takeHomePay.value), p.takeHomePay.isEstimate),
    spending,
    cash: est(clampMoney(p.cash.value, -TOGETHER_MONEY_MAX), p.cash.isEstimate),
    retirement: est(clampMoney(p.retirement.value), p.retirement.isEstimate),
    retirementShare: { ...p.retirementShare },
    debts,
  };
}

/**
 * A Profile from a shared plan's partner, for forecast() and goalStatus(). The plan holds no age,
 * so age is ageDefault, tagged as an estimate (the forecast does not use it).
 */
export function profileOfPartner(partner: TogetherPartner): Profile {
  const spending = {} as Profile['spending'];
  for (const c of COST_CATEGORIES) spending[c] = { ...partner.spending[c] };
  return {
    age: est(ageDefault.value, true),
    takeHomePay: { ...partner.takeHomePay },
    spending,
    cash: { ...partner.cash },
    retirement: { ...partner.retirement },
    retirementShare: { ...partner.retirementShare },
    debts: partner.debts.map((d) => ({ ...d, minPayment: { ...d.minPayment } })),
    doneMoveIds: [],
  };
}

/** Share of a positive surplus saved to retirement, weighted by take-home pay (plain mean if neither earns). */
function weightedShare(a: Profile, b: Profile): Rate {
  const wa = Math.max(0, a.takeHomePay.value);
  const wb = Math.max(0, b.takeHomePay.value);
  const total = wa + wb;
  if (total === 0) return (a.retirementShare.value + b.retirementShare.value) / 2;
  return (a.retirementShare.value * wa + b.retirementShare.value * wb) / total;
}

/** Debts of both partners, ids prefixed `a:` / `b:` and suffixed when one side repeats an id, so every id is unique. */
function mergeDebts(a: readonly Debt[], b: readonly Debt[]): Debt[] {
  const seen = new Set<string>();
  const out: Debt[] = [];
  const add = (prefix: string, d: Debt) => {
    const base = `${prefix}:${d.id}`;
    let id = base;
    for (let n = 2; seen.has(id); n++) id = `${base}#${n}`;
    seen.add(id);
    out.push({ ...d, id, minPayment: { ...d.minPayment } });
  };
  for (const d of a) add('a', d);
  for (const d of b) add('b', d);
  return out;
}

/**
 * One household Profile from two partners: pay, every spending category, cash and retirement are
 * summed; debts are concatenated with unique ids; a value is an estimate when either side's is;
 * `retirementShare` is weighted by take-home pay. Age (no effect on the forecast) is the older
 * partner's; ZIP is partner a's, else b's. Moves (committed, done) are personal and are dropped.
 */
export function combineProfiles(a: Profile, b: Profile): Profile {
  const spending = {} as Profile['spending'];
  for (const c of COST_CATEGORIES) {
    const x = a.spending[c];
    const y = b.spending[c];
    spending[c] = est(x.value + y.value, x.isEstimate || y.isEstimate);
  }
  const zip = a.zip ?? b.zip;
  return {
    age: est(Math.max(a.age.value, b.age.value), a.age.isEstimate || b.age.isEstimate),
    takeHomePay: est(a.takeHomePay.value + b.takeHomePay.value, a.takeHomePay.isEstimate || b.takeHomePay.isEstimate),
    spending,
    cash: est(a.cash.value + b.cash.value, a.cash.isEstimate || b.cash.isEstimate),
    retirement: est(a.retirement.value + b.retirement.value, a.retirement.isEstimate || b.retirement.isEstimate),
    retirementShare: est(weightedShare(a, b), a.retirementShare.isEstimate || b.retirementShare.isEstimate),
    debts: mergeDebts(a.debts, b.debts),
    ...(zip !== undefined && { zip }),
    doneMoveIds: [],
  };
}

export type HouseholdMonth = {
  takeHome: Money;     // monthly
  spending: Money;     // monthly, every category except the informational `debtPayments`
  debtPayments: Money; // monthly, minimum + extra payments from `debts`
  surplus: Money;      // takeHome − spending − debtPayments (negative = a shortfall)
  isEstimate: boolean; // any input behind these numbers is an estimate
};

/**
 * This month for a profile (use it on combineProfiles' result for the household): pay against
 * spending and debt payments, the same split simulate() uses for month 0. Debts with no balance
 * pay nothing.
 */
export function householdMonth(p: Profile): HouseholdMonth {
  let spending = 0;
  let isEstimate = p.takeHomePay.isEstimate;
  for (const c of COST_CATEGORIES) {
    if (c === 'debtPayments') continue;
    spending += p.spending[c].value;
    isEstimate ||= p.spending[c].isEstimate;
  }
  let debtPayments = 0;
  for (const d of p.debts) {
    if (d.balance <= 0) continue;
    debtPayments += d.minPayment.value + (d.extraPayment ?? 0);
    isEstimate ||= d.minPayment.isEstimate;
  }
  const takeHome = p.takeHomePay.value;
  return { takeHome, spending, debtPayments, surplus: takeHome - spending - debtPayments, isEstimate };
}

/** Shared bills of the household: the SHARED_BILL_CATEGORIES of both partners, added up (monthly). */
export function sharedBills(a: Profile, b: Profile): { total: Money; byCategory: Record<(typeof SHARED_BILL_CATEGORIES)[number], Money>; isEstimate: boolean } {
  const byCategory = {} as Record<(typeof SHARED_BILL_CATEGORIES)[number], Money>;
  let total = 0;
  let isEstimate = false;
  for (const c of SHARED_BILL_CATEGORIES) {
    byCategory[c] = a.spending[c].value + b.spending[c].value;
    total += byCategory[c];
    isEstimate ||= a.spending[c].isEstimate || b.spending[c].isEstimate;
  }
  return { total, byCategory, isEstimate };
}

export type FairSplit = {
  total: Money;                                   // monthly shared bills
  /** Split in proportion to take-home pay; 50/50 when neither has any. */
  byIncome: { a: Money; b: Money; shareA: number; basis: 'income' | 'even' };
  even: { a: Money; b: Money };
  /** How much more (+) or less (−) partner a pays by income than 50/50. */
  aVsEven: Money;
};

/** Splits `total` shared bills between two incomes (monthly take-home pay), against an even split. */
export function fairSplit(incomeA: Money, incomeB: Money, total: Money): FairSplit {
  if (![incomeA, incomeB, total].every(Number.isFinite)) throw new RangeError('fairSplit needs finite numbers');
  const ia = Math.max(0, incomeA);
  const ib = Math.max(0, incomeB);
  const t = Math.max(0, total);
  const basis = ia + ib > 0 ? 'income' : 'even';
  const shareA = basis === 'income' ? ia / (ia + ib) : 0.5;
  const a = t * shareA;
  return {
    total: t,
    byIncome: { a, b: t - a, shareA, basis },
    even: { a: t / 2, b: t / 2 },
    aVsEven: a - t / 2,
  };
}
