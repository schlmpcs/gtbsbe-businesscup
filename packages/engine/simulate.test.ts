// Hand-checked cases for the month-by-month simulation behind forecast() (Y2).
import { describe, expect, it } from 'vitest';
import type { CostCategory, Debt, Profile } from '@lifeguessr/types';
import { COST_CATEGORIES } from '@lifeguessr/types';
import {
  SYNTHETIC_CARD_ID,
  type ForecastRates,
  type ScheduledPurchase,
  cardMinPaymentFor,
  forecastMonths,
  hasEstimates,
  inflationAnnualOf,
  monthlyRate,
  resolveRates,
  simulate,
} from './simulate';

/** No growth, no yield, no returns: every result is plain arithmetic. */
const ZERO: Partial<ForecastRates> = { inflationAnnual: 0, cashYieldAnnual: 0, returnAnnualNominal: 0 };

function profile(o: {
  pay: number; other?: number; cash?: number; retirement?: number; share?: number; debts?: Debt[];
}): Profile {
  const spending = Object.fromEntries(
    COST_CATEGORIES.map((c) => [c, { value: c === 'other' ? (o.other ?? 0) : 0, isEstimate: false }]),
  ) as Record<CostCategory, { value: number; isEstimate: boolean }>;
  return {
    age: { value: 30, isEstimate: false },
    takeHomePay: { value: o.pay, isEstimate: false },
    spending,
    cash: { value: o.cash ?? 0, isEstimate: false },
    retirement: { value: o.retirement ?? 0, isEstimate: false },
    retirementShare: { value: o.share ?? 0, isEstimate: false },
    debts: o.debts ?? [],
    doneMoveIds: [],
  };
}

const debt = (o: Partial<Debt> & { balance: number; apr: number; min: number; estimate?: boolean }): Debt => ({
  id: o.id ?? 'd1',
  kind: o.kind ?? 'personal',
  balance: o.balance,
  apr: o.apr,
  minPayment: { value: o.min, isEstimate: o.estimate ?? false },
  ...(o.extraPayment !== undefined && { extraPayment: o.extraPayment }),
});

describe('rates and horizon', () => {
  it('monthly rate compounds back to the yearly rate', () => {
    expect((1 + monthlyRate(0.06)) ** 12).toBeCloseTo(1.06, 12);
    expect(monthlyRate(0)).toBe(0);
  });

  it('defaults come from assumptions; income growth follows inflation', () => {
    expect(resolveRates()).toEqual({
      inflationAnnual: 0.03, incomeGrowthAnnual: 0.03, cashYieldAnnual: 0.03,
      returnAnnualNominal: 0.06, cardApr: 0.2236,
    });
    expect(resolveRates({ inflationAnnual: 0.05 }).incomeGrowthAnnual).toBe(0.05);
    expect(() => resolveRates({ cashYieldAnnual: Number.NaN })).toThrow(RangeError);
  });

  it('inflation comes from the area CPI when there is one', () => {
    expect(inflationAnnualOf({ cpiYoY: { value: 0.041, source: { name: 'BLS', year: 2026 } } })).toBe(0.041);
    expect(inflationAnnualOf(undefined)).toBe(0.03);
  });

  it('simulates at least 120 months', () => {
    expect(forecastMonths(10)).toBe(120);
    expect(forecastMonths(5)).toBe(120);
    expect(forecastMonths(12)).toBe(144);
    expect(forecastMonths(10.5)).toBe(126);
    expect(() => forecastMonths(Number.NaN)).toThrow(RangeError);
    expect(() => forecastMonths(-1)).toThrow(RangeError);
    expect(() => forecastMonths(101)).toThrow(RangeError);
  });
});

describe('simulate: no debts', () => {
  it('zero growth → net worth is linear: cash + surplus × months', () => {
    const s = simulate(profile({ pay: 3000, other: 2000, cash: 1000 }), 120, { rates: ZERO });
    expect(s.path).toHaveLength(121);
    for (const point of s.path) expect(point.netWorth).toBeCloseTo(1000 + 1000 * point.month, 9);
  });

  it('splits a positive surplus by retirementShare', () => {
    const s = simulate(profile({ pay: 3000, other: 2000, cash: 1000, share: 0.25 }), 12, { rates: ZERO });
    expect(s.path[12]!.retirement).toBeCloseTo(3000, 9);
    expect(s.path[12]!.cash).toBeCloseTo(1000 + 750 * 12, 9);
  });

  it('ignores spending.debtPayments (payments come from debts)', () => {
    const p = profile({ pay: 3000, other: 2000 });
    p.spending.debtPayments = { value: 999, isEstimate: false };
    expect(simulate(p, 12, { rates: ZERO }).path[12]!.netWorth).toBeCloseTo(12_000, 9);
  });

  it('grows cash at cashYield, retirement at the nominal return, income and spending with inflation', () => {
    const s = simulate(profile({ pay: 1000, other: 500, cash: 1000, retirement: 10_000 }), 13, {
      rates: { inflationAnnual: 0.03, cashYieldAnnual: 0.03, returnAnnualNominal: 0.06 },
    });
    const flat = simulate(profile({ pay: 0, cash: 1000, retirement: 10_000 }), 12);
    expect(flat.path[12]!.cash).toBeCloseTo(1030, 9);
    expect(flat.path[12]!.retirement).toBeCloseTo(10_600, 9);
    expect(s.path[1]!.income).toBe(1000);
    expect(s.path[13]!.income).toBeCloseTo(1030, 9); // t = 12
    expect(s.path[13]!.spending).toBeCloseTo(515, 9);
  });
});

describe('simulate: debts', () => {
  it('a 0% debt is paid off in the expected month, then its payment rolls into the surplus', () => {
    const s = simulate(profile({ pay: 500, debts: [debt({ balance: 1000, apr: 0, min: 100 })] }), 20, { rates: ZERO });
    expect(s.payoffMonth.d1).toBe(10);
    expect(s.path[9]!.debts.d1).toBeCloseTo(100, 9);
    expect(s.path[10]!.debts.d1).toBe(0);
    expect(s.path[10]!.debtPayments).toBe(100);
    expect(s.path[11]!.debtPayments).toBe(0);
    expect(s.path[11]!.surplus).toBe(500);
    expect(s.path[10]!.cash).toBeCloseTo(4000, 9);
    expect(s.path[11]!.cash).toBeCloseTo(4500, 9);
    for (const point of s.path) expect(point.netWorth).toBeCloseTo(-1000 + 500 * point.month, 9);
  });

  it('charges apr/12 interest and caps the last payment at what is owed', () => {
    // $1,000 at 12%: month 1 interest 10, pays 510 → 500; month 2 interest 5, pays 505 → 0.
    const s = simulate(profile({ pay: 1000, debts: [debt({ balance: 1000, apr: 0.12, min: 510 })] }), 3, { rates: ZERO });
    expect(s.path[1]!.debts.d1).toBeCloseTo(500, 9);
    expect(s.path[2]!.debtPayments).toBeCloseTo(505, 9);
    expect(s.payoffMonth.d1).toBe(2);
    expect(s.path[2]!.netWorth).toBeCloseTo(2000 - 1000 - 15, 9);
  });

  it('extraPayment pays a debt off sooner', () => {
    const base = debt({ balance: 1000, apr: 0, min: 100 });
    const s = simulate(profile({ pay: 500, debts: [{ ...base, extraPayment: 150 }] }), 12, { rates: ZERO });
    expect(s.payoffMonth.d1).toBe(4); // 250/month: 250, 500, 750, 1000
    expect(s.path[1]!.requiredDebtPayments).toBe(100);
    expect(s.path[1]!.debtPayments).toBe(250);
  });

  it('a card with an estimated minimum follows the card formula every month', () => {
    const card = debt({ id: 'c', kind: 'card', balance: 6400, apr: 0.2436, min: 193.92, estimate: true });
    const s = simulate(profile({ pay: 5000, debts: [card] }), 2, { rates: ZERO });
    expect(s.path[1]!.debtPayments).toBeCloseTo(193.92, 9); // 6400 × (0.2436/12 + 0.01)
    expect(s.path[1]!.debts.c).toBeCloseTo(6336, 9);
    expect(s.path[2]!.debtPayments).toBeCloseTo(6336 * 0.0303, 9); // shrinks with the balance
  });

  it('card formula: interest + 1% of the balance, floor $25', () => {
    expect(cardMinPaymentFor(6400, 0.2436)).toBeCloseTo(193.92, 9);
    expect(cardMinPaymentFor(1000, 0.12)).toBe(25);
    expect(cardMinPaymentFor(0, 0.2)).toBe(0);
  });

  it('a card with a measured minimum pays that fixed amount', () => {
    const card = debt({ id: 'c', kind: 'card', balance: 6400, apr: 0.2436, min: 300 });
    const s = simulate(profile({ pay: 5000, debts: [card] }), 3, { rates: ZERO });
    expect(s.path.slice(1).map((m) => m.debtPayments)).toEqual([300, 300, 300]);
  });
});

describe('simulate: negative surplus', () => {
  it('draws cash down, then rolls the shortfall onto a new card at the card APR', () => {
    const s = simulate(profile({ pay: 1000, other: 1500, cash: 1200 }), 4, { rates: { ...ZERO, cardApr: 0.24 } });
    expect(s.path.slice(1, 4).map((m) => m.cash)).toEqual([700, 200, 0]);
    expect(s.path[3]!.shortfallToCard).toBe(300);
    expect(s.path[3]!.debts[SYNTHETIC_CARD_ID]).toBe(300);
    // Month 4: interest 300 × 2% = 6, minimum max(25, 6 + 3) = 25, new shortfall 500 + 25.
    expect(s.path[4]!.debtPayments).toBe(25);
    expect(s.path[4]!.cardBalance).toBeCloseTo(300 + 6 - 25 + 525, 9);
    expect(s.path[4]!.netWorth).toBeCloseTo(-806, 9);
  });

  it('uses the profile card when there is one', () => {
    const card = debt({ id: 'c', kind: 'card', balance: 0, apr: 0.3, min: 0, estimate: true });
    const s = simulate(profile({ pay: 1000, other: 1100, debts: [card] }), 2, { rates: ZERO });
    expect(s.path[1]!.debts.c).toBe(100);
    expect(s.path[2]!.debts.c).toBeCloseTo(100 + 2.5 - 25 + 125, 9); // 30%/12 interest, $25 floor
    expect(s.path[2]!.debts[SYNTHETIC_CARD_ID]).toBeUndefined();
  });
});

describe('simulate: purchases', () => {
  const p = profile({ pay: 3000, other: 2000, cash: 10_000 });
  const base = simulate(p, 24, { rates: { ...ZERO, cardApr: 0.24 } });
  const diff = (extra: ScheduledPurchase[], rates: Partial<ForecastRates> = { ...ZERO, cardApr: 0.24 }) => {
    const s = simulate(p, 24, { extra, rates });
    return { s, d: s.path.map((m, i) => m.netWorth - base.path[i]!.netWorth) };
  };

  it('one-time cash: lowers cash once', () => {
    const { s, d } = diff([{ label: 'TV', amount: 500, recurring: false, payWith: 'cash' }]);
    expect(s.path[1]!.purchasesCash).toBe(500);
    expect(s.path[2]!.purchasesCash).toBe(0);
    expect(d[0]).toBe(0);
    for (const x of d.slice(1)) expect(x).toBeCloseTo(-500, 9);
  });

  it('one-time card: adds to the card balance, which then accrues interest', () => {
    const { s, d } = diff([{ label: 'TV', amount: 500, recurring: false, payWith: 'card' }]);
    expect(s.path[1]!.cardCharges).toBe(500);
    expect(s.path[1]!.cardBalance).toBe(500);
    expect(s.path[1]!.cash).toBe(base.path[1]!.cash);
    expect(d[1]).toBeCloseTo(-500, 9);
    expect(s.path[2]!.cardBalance).toBeCloseTo(500 + 10 - 25, 9);
    expect(d[2]).toBeCloseTo(-510, 9);
  });

  it('loan: adds an amortizing debt whose first payment is next month', () => {
    const { s, d } = diff([{
      label: 'Laptop', amount: 1200, recurring: false,
      payWith: { loan: { amount: 1200, apr: 0, termMonths: 12 } },
    }]);
    expect(s.path[1]!.purchasesCash).toBe(0);
    expect(s.path[1]!.debts['purchase-m1']).toBe(1200);
    expect(s.path[2]!.debtPayments).toBeCloseTo(100, 9);
    expect(s.payoffMonth['purchase-m1']).toBe(13);
    for (const x of d.slice(1)) expect(x).toBeCloseTo(-1200, 9);
  });

  it('loan with a down payment and fees: down payment from cash, fees rolled into the loan', () => {
    const { s, d } = diff([{
      label: 'Car', amount: 10_000, recurring: false,
      payWith: { loan: { amount: 10_000, apr: 0, termMonths: 10, downPayment: 2000, fees: 300 } },
    }]);
    expect(s.path[1]!.purchasesCash).toBe(2000);
    expect(s.path[1]!.debts['purchase-m1']).toBe(8300);
    expect(s.path[2]!.debtPayments).toBeCloseTo(830, 9);
    expect(s.payoffMonth['purchase-m1']).toBe(11);
    expect(d[1]).toBeCloseTo(-10_300, 9);
  });

  it('recurring: monthly every month, yearly every 12 months, prices rising with inflation', () => {
    const monthly = diff([{ label: 'Gym', amount: 100, recurring: 'monthly', payWith: 'cash' }]);
    for (const [m, x] of monthly.d.entries()) expect(x).toBeCloseTo(-100 * m, 9);

    const yearly = diff([{ label: 'Insurance', amount: 600, recurring: 'yearly', payWith: 'cash' }]);
    const months = yearly.s.path.filter((m) => m.purchasesCash > 0).map((m) => m.month);
    expect(months).toEqual([1, 13]);

    const inflated = simulate(p, 13, {
      rates: { ...ZERO, inflationAnnual: 0.12 },
      extra: [{ label: 'Gym', amount: 100, recurring: 'monthly', payWith: 'cash' }],
    });
    expect(inflated.path[1]!.purchasesCash).toBe(100);
    expect(inflated.path[13]!.purchasesCash).toBeCloseTo(112, 9);
  });

  it('startMonth delays the first occurrence', () => {
    const { s } = diff([{ label: 'TV', amount: 500, recurring: false, payWith: 'cash', startMonth: 3 }]);
    expect(s.path.map((m) => m.purchasesCash)).toEqual(s.path.map((m) => (m.month === 4 ? 500 : 0)));
    expect(() => simulate(p, 12, { extra: [{ label: 'x', amount: 1, recurring: false, payWith: 'cash', startMonth: -1 }] }))
      .toThrow(RangeError);
  });

  it('a cash purchase larger than cash goes on a card', () => {
    const { s } = diff([{ label: 'Trip', amount: 12_000, recurring: false, payWith: 'cash' }]);
    // 10,000 cash + 1,000 surplus − 12,000 = −1,000 → card
    expect(s.path[1]!.cash).toBe(0);
    expect(s.path[1]!.shortfallToCard).toBeCloseTo(1000, 9);
  });
});

describe('simulate: payOffFromSurplus', () => {
  const p = profile({ pay: 3000, other: 2000, cash: 10_000 }); // $1,000 surplus a month
  const rates = { ...ZERO, cardApr: 0.24 };
  const tv = (amount: number, o: Partial<ScheduledPurchase> = {}): ScheduledPurchase => ({
    label: 'TV', amount, recurring: false, payWith: 'card', payOffFromSurplus: true, ...o,
  });

  it('is off by default: no own card, no payoff flows', () => {
    const s = simulate(p, 3, { rates, extra: [tv(500, { payOffFromSurplus: undefined })] });
    expect(s.payoffCardIds).toEqual([null]);
    for (const m of s.path) {
      expect(m.payoffCardCharges).toBe(0);
      expect(m.surplusToPayoffCards).toBe(0);
    }
  });

  it('a card purchase goes on its own card, which the surplus pays off before cash', () => {
    const s = simulate(p, 4, { rates, extra: [tv(2500)] });
    const id = s.payoffCardIds[0]!;
    expect(id).toBe('purchase-card-1');
    // Month 1: charged 2,500, the 1,000 surplus pays it down, cash unchanged.
    expect(s.path[1]).toMatchObject({ cardCharges: 2500, payoffCardCharges: 2500, surplusToPayoffCards: 1000, cash: 10_000 });
    expect(s.path[1]!.debts[id]).toBe(1500);
    // Month 2: 2% interest (30) and the card minimum max(25, 30 + 15) = 45; the other 955 pays it down.
    expect(s.path[2]!.debtPayments).toBeCloseTo(45, 9);
    expect(s.path[2]!.requiredDebtPayments).toBeCloseTo(45, 9);
    expect(s.path[2]!.surplusToPayoffCards).toBeCloseTo(955, 9);
    expect(s.path[2]!.debts[id]).toBeCloseTo(530, 9);
    expect(s.path[2]!.cash).toBe(10_000);
    // Month 3: interest 10.60, minimum $25, the remaining 515.60 is paid; the rest goes to cash.
    expect(s.path[3]!.surplusToPayoffCards).toBeCloseTo(515.6, 9);
    expect(s.path[3]!.debts[id]).toBe(0);
    expect(s.path[3]!.cash).toBeCloseTo(10_000 + 975 - 515.6, 9);
    expect(s.payoffMonth[id]).toBe(3);
    expect(s.path[4]!.surplusToPayoffCards).toBe(0);
  });

  it('uses the profile card APR, leaves that card alone and pays before retirementShare', () => {
    const card = debt({ id: 'c', kind: 'card', balance: 1000, apr: 0.12, min: 100 });
    const q = profile({ pay: 3100, other: 2000, cash: 10_000, share: 0.5, debts: [card] }); // $1,000 surplus
    const s = simulate(q, 2, { rates, extra: [tv(1500)] });
    const id = s.payoffCardIds[0]!;
    expect(s.path[1]!.debts.c).toBeCloseTo(1000 + 10 - 100, 9);
    expect(s.path[1]!.debts[id]).toBe(500);
    expect(s.path[1]!.retirement).toBe(0);
    // Month 2: 1% interest (5), minimum $25, the remaining 480 from the surplus; 495 split 50/50.
    expect(s.path[2]!.debts[id]).toBe(0);
    expect(s.path[2]!.retirement).toBeCloseTo((1000 - 25 - 480) / 2, 9);
    expect(s.path[2]!.cardBalance).toBeCloseTo(s.path[2]!.debts.c!, 9);
  });

  it('a cash purchase it cannot cover: the shortfall it caused goes on its own card', () => {
    const s = simulate(p, 2, { rates, extra: [tv(12_000, { payWith: 'cash' })] });
    const id = s.payoffCardIds[0]!;
    // 10,000 cash + 1,000 surplus − 12,000 = −1,000.
    expect(s.path[1]).toMatchObject({ cash: 0, shortfallToCard: 1000, payoffCardCharges: 1000, cardCharges: 0 });
    expect(s.path[1]!.debts[id]).toBe(1000);
    expect(s.path[1]!.debts[SYNTHETIC_CARD_ID]).toBeUndefined();
    // Month 2: 20 interest, minimum 20 + 10 = 30, then the other 970 of the surplus: 20 left.
    expect(s.path[2]!.debts[id]).toBeCloseTo(20, 9);
    expect(s.path[2]!.cash).toBe(0);
  });

  it('only the shortfall the purchase caused: a plan already short keeps its own on the shared card', () => {
    const short = profile({ pay: 1000, other: 1500, cash: 0 }); // −500 a month without the purchase
    const s = simulate(short, 1, { rates, extra: [tv(300, { payWith: 'cash' })] });
    expect(s.path[1]!.shortfallToCard).toBe(800);
    expect(s.path[1]!.debts[s.payoffCardIds[0]!]).toBe(300);
    expect(s.path[1]!.debts[SYNTHETIC_CARD_ID]).toBe(500);
  });

  it('a cash purchase that cash covers is unchanged by the flag', () => {
    const extra = (payOffFromSurplus: boolean) => [tv(500, { payWith: 'cash', payOffFromSurplus })];
    const on = simulate(p, 12, { rates, extra: extra(true) });
    expect(on.path).toEqual(simulate(p, 12, { rates, extra: extra(false) }).path);
    expect(on.payoffCardIds).toEqual([null]);
  });
});

describe('simulate: estimates', () => {
  it('reports whether any read input is an estimate', () => {
    const p = profile({ pay: 1000 });
    expect(hasEstimates(p)).toBe(false);
    p.spending.debtPayments = { value: 100, isEstimate: true }; // not read by the simulation
    expect(hasEstimates(p)).toBe(false);
    p.spending.groceries = { value: 100, isEstimate: true };
    expect(hasEstimates(p)).toBe(true);
  });

  it('low/high shift estimated income and spending by ±15%', () => {
    const p = profile({ pay: 1000, other: 400 });
    p.takeHomePay.isEstimate = true;
    p.spending.other.isEstimate = true;
    const low = simulate(p, 1, { rates: ZERO, scenario: 'low' }).path[1]!;
    const high = simulate(p, 1, { rates: ZERO, scenario: 'high' }).path[1]!;
    expect(low.income).toBeCloseTo(850, 9);
    expect(low.spending).toBeCloseTo(460, 9);
    expect(high.income).toBeCloseTo(1150, 9);
    expect(high.spending).toBeCloseTo(340, 9);
  });

  it('an estimated debt payment is lower in the low scenario when the APR beats the cash yield', () => {
    const p = profile({ pay: 1000, debts: [debt({ balance: 5000, apr: 0.1, min: 200, estimate: true })] });
    expect(simulate(p, 1, { rates: ZERO, scenario: 'low' }).path[1]!.debtPayments).toBeCloseTo(170, 9);
    expect(simulate(p, 1, { rates: ZERO, scenario: 'high' }).path[1]!.debtPayments).toBeCloseTo(230, 9);
    const bnpl = profile({ pay: 1000, debts: [debt({ balance: 600, apr: 0, min: 100, estimate: true })] });
    const rates = { ...ZERO, cashYieldAnnual: 0.03 };
    expect(simulate(bnpl, 1, { rates, scenario: 'low' }).path[1]!.debtPayments).toBeCloseTo(115, 9);
  });
});

describe('debtAprDefaults', () => {
  it('uses the sourced card rate for cards and a decimal APR for every debt kind', async () => {
    const { debtAprDefaults, cardAprDefault } = await import('./assumptions');
    const { DEBT_KINDS } = await import('@lifeguessr/types');
    expect(debtAprDefaults.value.card).toBe(cardAprDefault.value);
    for (const k of DEBT_KINDS) {
      expect(debtAprDefaults.value[k]).toBeGreaterThanOrEqual(0);
      expect(debtAprDefaults.value[k]).toBeLessThan(1);
    }
  });
});
