// Every number "Together" shows, from the engine: the household month, the fair split of shared
// bills, "Us in 10 years" (rules forecast of the combined profile, today's dollars) and the shared
// goal's verdict. No math here beyond picking fields.
import {
  cardAprDefault, cardMinPaymentFor, combineProfiles, fairSplit, forecast, goalStatus, householdMonth, partnerOfProfile,
  profileOfPartner, retirementShareDefault, sharedBills, simulate,
} from '@lifeguessr/engine';
import { COST_CATEGORIES, type Profile, type TogetherPartner, type TogetherPlan } from '@lifeguessr/types';
import type { PartnerTotalsVM, QuickInputs, TogetherResultVM } from './types';

const est = (value: number, isEstimate: boolean) => ({ value, isEstimate });

/**
 * A partner from the quick inputs. What they typed is theirs (not an estimate); what they left
 * blank in the spending lines is 0, which they can see on the form. A debt with no APR uses the
 * Fed's average card APR and one with no payment the typical card minimum, both tagged as
 * estimates. No retirement saving share was asked: the default (0) is an estimate.
 */
export function quickPartner(q: QuickInputs, nickname: string): TogetherPartner {
  const spending = {} as TogetherPartner['spending'];
  for (const c of COST_CATEGORIES) spending[c] = est(0, false);
  spending.rentUtilities = est(q.rentUtilities ?? 0, false);
  spending.groceries = est(q.groceries ?? 0, false);
  spending.childcare = est(q.childcare ?? 0, false);
  spending.other = est(q.otherSpending ?? 0, false);
  const balance = q.debtBalance ?? 0;
  const apr = q.debtApr ?? cardAprDefault.value;
  const debts: TogetherPartner['debts'] =
    balance > 0
      ? [{
          id: 'd1',
          kind: 'card',
          balance,
          apr,
          minPayment: q.debtPayment !== null ? est(q.debtPayment, false) : est(cardMinPaymentFor(balance, apr), true),
        }]
      : [];
  const name = nickname.trim();
  return {
    ...(name ? { nickname: name } : {}),
    takeHomePay: est(q.takeHomePay ?? 0, false),
    spending,
    cash: est(q.cash ?? 0, false),
    retirement: est(q.retirement ?? 0, false),
    retirementShare: est(retirementShareDefault.value, true),
    debts,
  };
}

/**
 * The quick inputs that describe a partner, for "Use example numbers": the shared bills as they are,
 * every other spending line (but debt payments) summed into "everything else", debts summed into one balance at the
 * balance-weighted APR with their payments added up. Rounded to whole dollars, as the form takes them.
 */
export function quickOfPartner(partner: TogetherPartner): QuickInputs {
  const s = partner.spending;
  // Debt payments come from the debts themselves, never from a spending line.
  const notOther = new Set<string>(['rentUtilities', 'groceries', 'childcare', 'debtPayments']);
  const other = COST_CATEGORIES.filter((c) => !notOther.has(c)).reduce((sum, c) => sum + s[c].value, 0);
  const balance = partner.debts.reduce((sum, d) => sum + d.balance, 0);
  const apr = balance > 0 ? partner.debts.reduce((sum, d) => sum + d.apr * d.balance, 0) / balance : null;
  const payment = partner.debts.reduce((sum, d) => sum + d.minPayment.value, 0);
  return {
    takeHomePay: Math.round(partner.takeHomePay.value),
    rentUtilities: Math.round(s.rentUtilities.value),
    groceries: Math.round(s.groceries.value),
    childcare: Math.round(s.childcare.value),
    otherSpending: Math.round(other),
    cash: Math.round(partner.cash.value),
    retirement: Math.round(partner.retirement.value),
    debtBalance: balance > 0 ? Math.round(balance) : null,
    debtApr: apr,
    debtPayment: balance > 0 ? Math.round(payment) : null,
  };
}

/** A partner from the profile the person made in this app (only the plan's fields leave the browser). */
export const profilePartner = (p: Profile, nickname: string): TogetherPartner => partnerOfProfile(p, nickname);

function totals(partner: TogetherPartner): PartnerTotalsVM {
  const m = householdMonth(profileOfPartner(partner));
  return { label: partner.nickname ?? null, takeHome: m.takeHome, spending: m.spending, debtPayments: m.debtPayments };
}

/** The whole result for a plan with both partners. Throws (the hook wraps it) on an engine error. */
export function togetherResult(plan: TogetherPlan & { partner2: TogetherPartner }): TogetherResultVM {
  const a = profileOfPartner(plan.partner1);
  const b = profileOfPartner(plan.partner2);
  const household = combineProfiles(a, b);
  const month = householdMonth(household);
  const bills = sharedBills(a, b);
  const split = fairSplit(a.takeHomePay.value, b.takeHomePay.value, bills.total);
  const f = forecast(household, 10, { todaysDollars: true });
  const status = plan.goal ? goalStatus(household, plan.goal) : null;
  return {
    partners: [totals(plan.partner1), totals(plan.partner2)],
    month,
    split: {
      total: split.total,
      byCategory: bills.byCategory,
      p1: split.byIncome.a,
      p2: split.byIncome.b,
      p1Share: split.byIncome.shareA,
      basis: split.byIncome.basis,
      evenEach: split.even.a,
      p1VsEven: split.aVsEven,
      isEstimate: bills.isEstimate || a.takeHomePay.isEstimate || b.takeHomePay.isEstimate,
    },
    future: {
      today: simulate(household, 0).path[0]!.netWorth,
      low: f.in10y.low,
      mid: f.in10y.mid,
      high: f.in10y.high,
      isEstimate: f.in10y.low !== f.in10y.high,
      source: 'rules',
    },
    goal: status && {
      target: status.goal.target,
      years: status.goal.years,
      verdict: status.verdict,
      projectedMid: status.projected.mid,
      gap: status.gap,
      progress: status.progress,
    },
  };
}
