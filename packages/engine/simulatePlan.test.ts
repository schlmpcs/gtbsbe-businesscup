// Hand-checked cases for the plan options of simulate() (MP3, #163): shortfall balance, withdrawal
// order, savings split, per-group growth, manual expenses and per-year rate arrays.
import { describe, expect, it } from 'vitest';
import type { CostCategory, Profile } from '@lifeguessr/types';
import { COST_CATEGORIES } from '@lifeguessr/types';
import { type ForecastRates, simulate } from './simulate';

/** No growth, no yield, no returns: every result is plain arithmetic. */
const ZERO: Partial<ForecastRates> = { inflationAnnual: 0, cashYieldAnnual: 0, returnAnnualNominal: 0 };

function profile(o: {
  pay: number; other?: number; rent?: number; cash?: number; retirement?: number; share?: number; asOf?: string;
}): Profile {
  const spending = Object.fromEntries(COST_CATEGORIES.map((c) => [c, {
    value: c === 'other' ? (o.other ?? 0) : c === 'rentUtilities' ? (o.rent ?? 0) : 0, isEstimate: false,
  }])) as Record<CostCategory, { value: number; isEstimate: boolean }>;
  return {
    age: { value: 30, isEstimate: false },
    takeHomePay: { value: o.pay, isEstimate: false },
    spending,
    cash: { value: o.cash ?? 0, isEstimate: false },
    retirement: { value: o.retirement ?? 0, isEstimate: false },
    retirementShare: { value: o.share ?? 0, isEstimate: false },
    debts: [],
    doneMoveIds: [],
    ...(o.asOf !== undefined && { asOf: o.asOf }),
  };
}

describe('simulate plan options: defaults', () => {
  it('no plan option → no groups, no shortfall fields (today\'s output)', () => {
    const m = simulate(profile({ pay: 3000, other: 1000 }), 3).path[1]!;
    expect(m.groups).toBeUndefined();
    expect(m.shortfall).toBeUndefined();
    expect(m.shortfallAdded).toBeUndefined();
  });

  it('plan options at their defaults reproduce the plain simulation', () => {
    // Cash runs out in month 3 and the rest goes on the synthetic card, exactly as without options.
    const p = profile({ pay: 1000, other: 1500, cash: 1200, retirement: 500, share: 0.3 });
    const plain = simulate(p, 24);
    const withDefaults = simulate(p, 24, { shortfallMode: 'card', withdrawalOrder: [], expenses: { mode: 'budget' } });
    for (const [m, month] of withDefaults.path.entries()) {
      const { groups: _g, shortfall, shortfallAdded: _a, oneOffIncome: _o, debtFlows: _d, ...rest } = month;
      expect(rest).toEqual(plain.path[m]);
      expect(shortfall).toBe(0);
    }
  });
});

describe('simulate plan options: shortfallMode', () => {
  it("'separate': zero income, $10k cash, $2k/month → cash is 0 in month 5, then the shortfall grows", () => {
    // Cash: 10000 − 2000 m → 8000, 6000, 4000, 2000, 0 at months 1–5.
    // Month 6 on: nothing left, so 2000 a month accrues on the shortfall: 2000, 4000, 6000 at months 6–8.
    const sim = simulate(profile({ pay: 0, other: 2000, cash: 10_000 }), 8, { rates: ZERO, shortfallMode: 'separate' });
    expect(sim.path[4]!.cash).toBe(2000);
    expect(sim.path[5]!.cash).toBe(0);
    expect(sim.path[5]!.shortfall).toBe(0);
    expect(sim.path[6]!.shortfall).toBe(2000);
    expect(sim.path[6]!.shortfallAdded).toBe(2000);
    expect(sim.path[8]!.shortfall).toBe(6000);
    expect(sim.path[6]!.netWorth).toBe(-2000);
    expect(sim.path[8]!.netWorth).toBe(-6000);
    // No card is opened for it.
    expect(sim.path[8]!.debtBalance).toBe(0);
    expect(sim.path[8]!.shortfallToCard).toBe(0);
    expect(sim.path[8]!.debts).toEqual({});
  });

  it('the shortfall grows with inflation', () => {
    // Inflation i with (1 + i)^(1/12) = 1.01: prices and the shortfall both grow 1% a month.
    // Spending in month m = 1000 × 1.01^(m−1). Shortfall: S1 = 1000; S2 = 1000 × 1.01 + 1010 = 2020;
    // S3 = 2020 × 1.01 + 1020.1 = 3060.3; in general Sm = m × 1000 × 1.01^(m−1).
    const inflationAnnual = 1.01 ** 12 - 1;
    const sim = simulate(profile({ pay: 0, other: 1000 }), 12, {
      rates: { ...ZERO, inflationAnnual }, shortfallMode: 'separate',
    });
    expect(sim.path[1]!.shortfall).toBeCloseTo(1000, 9);
    expect(sim.path[2]!.shortfall).toBeCloseTo(2020, 9);
    expect(sim.path[3]!.shortfall).toBeCloseTo(3060.3, 9);
    expect(sim.path[3]!.shortfallAdded).toBeCloseTo(1020.1, 9);
    expect(sim.path[12]!.shortfall).toBeCloseTo(12 * 1000 * 1.01 ** 11, 6);
  });
});

describe('simulate plan options: withdrawalOrder', () => {
  // Zero income, $2k/month spending, ZERO rates, cash 0; investments 5000, retirement 5000.
  const p = profile({ pay: 0, other: 2000, retirement: 5000 });
  const base = { rates: ZERO, shortfallMode: 'separate' as const, balances: { investments: 5000 } };

  it('investments drain before retirement; reversing the order reverses it', () => {
    // Investments first: inv 3000, 1000, then month 3 takes inv 1000 + ret 1000 (inv 0, ret 4000);
    // ret 2000, 0 in months 4–5; month 6 → shortfall 2000.
    const a = simulate(p, 6, { ...base, withdrawalOrder: ['investments', 'retirement'] });
    expect(a.path.map((m) => m.groups!.investments.balance)).toEqual([5000, 3000, 1000, 0, 0, 0, 0]);
    expect(a.path.map((m) => m.retirement)).toEqual([5000, 5000, 5000, 4000, 2000, 0, 0]);
    expect(a.path[3]!.groups!.investments.withdrawals).toBe(1000);
    expect(a.path[3]!.groups!.retirement.withdrawals).toBe(1000);
    expect(a.path[5]!.shortfall).toBe(0);
    expect(a.path[6]!.shortfall).toBe(2000);
    // Reversed: the same numbers with the two groups swapped.
    const b = simulate(p, 6, { ...base, withdrawalOrder: ['retirement', 'investments'] });
    expect(b.path.map((m) => m.retirement)).toEqual([5000, 3000, 1000, 0, 0, 0, 0]);
    expect(b.path.map((m) => m.groups!.investments.balance)).toEqual([5000, 5000, 5000, 4000, 2000, 0, 0]);
    expect(b.path[6]!.shortfall).toBe(2000);
  });

  it('cash is drawn first wherever it is listed; without an order nothing else is drawn', () => {
    // Cash 1000 covers half of month 1; investments the other 1000.
    const c = simulate(profile({ pay: 0, other: 2000, cash: 1000 }), 1, {
      rates: ZERO, shortfallMode: 'separate', balances: { investments: 5000 }, withdrawalOrder: ['investments', 'cash'],
    });
    expect(c.path[1]!.cash).toBe(0);
    expect(c.path[1]!.groups!.cash.withdrawals).toBe(1000);
    expect(c.path[1]!.groups!.investments.balance).toBe(4000);
    expect(c.path[1]!.shortfall).toBe(0);
    // No order: the 2000 goes straight to the shortfall; investments and retirement stay whole.
    const d = simulate(p, 1, base);
    expect(d.path[1]!.shortfall).toBe(2000);
    expect(d.path[1]!.retirement).toBe(5000);
    expect(d.path[1]!.groups!.investments.balance).toBe(5000);
  });

  it("'card' mode: what the groups cannot cover goes on a card", () => {
    // Months 1–5 drain the 10000; month 6's 2000 goes on the synthetic card.
    const e = simulate(p, 6, { rates: ZERO, balances: { investments: 5000 }, withdrawalOrder: ['investments', 'retirement'] });
    expect(e.path[5]!.shortfallToCard).toBe(0);
    expect(e.path[6]!.shortfallToCard).toBe(2000);
    expect(e.path[6]!.cardBalance).toBe(2000);
    expect(e.path[6]!.shortfall).toBe(0);
  });

  it('rejects a liability group', () => {
    expect(() => simulate(p, 1, { withdrawalOrder: ['creditCard'] })).toThrow(RangeError);
  });
});

describe('simulate plan options: savingsSplit', () => {
  it('50/50 cash/investments: each month half of the surplus goes to each', () => {
    // Surplus 3000 − 1000 = 2000 → 1000 to cash and 1000 to investments a month; retirementShare
    // (0.5) is not used, so retirement stays 0. After 12 months: 12000 and 12000.
    const sim = simulate(profile({ pay: 3000, other: 1000, share: 0.5 }), 12, {
      rates: ZERO, savingsSplit: [{ group: 'cash', share: 0.5 }, { group: 'investments', share: 0.5 }],
    });
    expect(sim.path[1]!.groups!.cash.deposits).toBe(1000);
    expect(sim.path[1]!.groups!.investments.deposits).toBe(1000);
    expect(sim.path[12]!.cash).toBe(12_000);
    expect(sim.path[12]!.groups!.investments.balance).toBe(12_000);
    expect(sim.path[12]!.retirement).toBe(0);
    expect(sim.path[12]!.netWorth).toBe(24_000);
  });

  it('rejects shares that do not sum to 1 and liability groups', () => {
    const p = profile({ pay: 3000 });
    expect(() => simulate(p, 1, { savingsSplit: [{ group: 'cash', share: 0.5 }] })).toThrow(RangeError);
    expect(() => simulate(p, 1, { savingsSplit: [{ group: 'loan', share: 1 }] })).toThrow(RangeError);
    expect(() => simulate(p, 1, { savingsSplit: [{ group: 'cash', share: -0.5 }, { group: 'investments', share: 1.5 }] }))
      .toThrow(RangeError);
  });
});

describe('simulate plan options: per-group growth', () => {
  // No income or spending: each balance only grows. 12 monthly steps at (1 + a)^(1/12) − 1 compound
  // to exactly 1 + a.
  const p = profile({ pay: 0, cash: 1000, retirement: 2000 });
  const balances = { investments: 10_000, realEstate: 300_000, vehicle: 20_000, otherAsset: 5000 };
  const rates = { inflationAnnual: 0.03, cashYieldAnnual: 0.02, returnAnnualNominal: 0.06 };

  it('defaults: cash yield, return, inflation for real estate and other, −15% for vehicles', () => {
    // cash 1000 × 1.02 = 1020; retirement 2000 × 1.06 = 2120; investments 10000 × 1.06 = 10600;
    // realEstate 300000 × 1.03 = 309000; vehicle 20000 × 0.85 = 17000; otherAsset 5000 × 1.03 = 5150.
    // Net worth = 1020 + 2120 + 10600 + 309000 + 17000 + 5150 = 344890.
    const end = simulate(p, 12, { rates, balances }).path[12]!;
    expect(end.cash).toBeCloseTo(1020, 6);
    expect(end.retirement).toBeCloseTo(2120, 6);
    expect(end.groups!.investments.balance).toBeCloseTo(10_600, 6);
    expect(end.groups!.realEstate.balance).toBeCloseTo(309_000, 6);
    expect(end.groups!.vehicle.balance).toBeCloseTo(17_000, 6);
    expect(end.groups!.otherAsset.balance).toBeCloseTo(5150, 6);
    expect(end.netWorth).toBeCloseTo(344_890, 6);
  });

  it('growth overrides replace the defaults; growth flows add up to the change', () => {
    // cash 1000 × 1.04 = 1040; retirement 2000 × 1.07 = 2140; investments 10000 × 1.08 = 10800;
    // realEstate 300000 × 1.05 = 315000; vehicle 20000 × 0.90 = 18000; otherAsset 5000 × 1.00 = 5000.
    const sim = simulate(p, 12, {
      rates, balances,
      growth: { cash: 0.04, retirement: 0.07, investments: 0.08, realEstate: 0.05, vehicle: -0.1, otherAsset: 0 },
    });
    const end = sim.path[12]!;
    expect(end.cash).toBeCloseTo(1040, 6);
    expect(end.retirement).toBeCloseTo(2140, 6);
    expect(end.groups!.investments.balance).toBeCloseTo(10_800, 6);
    expect(end.groups!.realEstate.balance).toBeCloseTo(315_000, 6);
    expect(end.groups!.vehicle.balance).toBeCloseTo(18_000, 6);
    expect(end.groups!.otherAsset.balance).toBe(5000);
    // Σ monthly vehicle growth = 18000 − 20000 = −2000; month 1 = 20000 × (0.9^(1/12) − 1).
    const vehicleGrowth = sim.path.reduce((s, m) => s + m.groups!.vehicle.growth, 0);
    expect(vehicleGrowth).toBeCloseTo(-2000, 6);
    expect(sim.path[1]!.groups!.vehicle.growth).toBeCloseTo(20_000 * (0.9 ** (1 / 12) - 1), 9);
  });
});

describe('simulate plan options: expenses mode', () => {
  it("'manual' replaces every category with one monthly amount", () => {
    // Budget: rentUtilities 500 + other 1000 = 1500 a month. Manual 2200 replaces it; with 3% inflation,
    // month 13 (t = 12) spends 2200 × 1.03 = 2266.
    const p = profile({ pay: 3000, rent: 500, other: 1000 });
    const rates = { ...ZERO, inflationAnnual: 0.03 };
    expect(simulate(p, 1, { rates, expenses: { mode: 'budget' } }).path[1]!.spending).toBe(1500);
    const manual = simulate(p, 13, { rates, expenses: { mode: 'manual', monthly: 2200 } });
    expect(manual.path[1]!.spending).toBe(2200);
    expect(manual.path[13]!.spending).toBeCloseTo(2266, 9);
    expect(() => simulate(p, 1, { expenses: { mode: 'manual', monthly: -1 } })).toThrow(RangeError);
  });
});

describe('simulate plan options: dated debts and assets (expandEvent output)', () => {
  it('a new debt opens in its month and is first paid the month after', () => {
    // Pay 1000, nothing spent, ZERO rates. Debt 1200 at 0% with a $100 payment, month index 1:
    // month 1: cash 1000, no debt; month 2: cash 2000, debt 1200 (opened after payments), net worth
    // 2000 − 1200 = 800; month 3: pays 100 → debt 1100, cash 2000 + 900 = 2900.
    const loan = { id: 'ev:loan', kind: 'personal' as const, balance: 1200, apr: 0, minPayment: { value: 100, isEstimate: false } };
    const sim = simulate(profile({ pay: 1000 }), 3, { rates: ZERO, newDebts: [{ month: 1, debt: loan }] });
    expect(sim.path[1]!.debts).toEqual({});
    expect(sim.path[2]!.debts).toEqual({ 'ev:loan': 1200 });
    expect(sim.path[2]!.debtPayments).toBe(0);
    expect(sim.path[2]!.netWorth).toBe(800);
    expect(sim.path[3]!.debts['ev:loan']).toBe(1100);
    expect(sim.path[3]!.debtPayments).toBe(100);
    expect(sim.path[3]!.cash).toBe(2900);
    expect(sim.debtApr).toEqual({ 'ev:loan': 0 });
  });

  it('a new asset is a deposit in its month and grows from the next', () => {
    // 100000 of real estate at month index 2 (path[3]), growth 12%: path[3] = 100000, then 12 monthly
    // steps (t = 3..14) give path[15] = 100000 × 1.12 = 112000.
    const sim = simulate(profile({ pay: 0 }), 15, {
      rates: ZERO, growth: { realEstate: 0.12 }, newAssets: [{ group: 'realEstate', month: 2, value: 100_000 }],
    });
    expect(sim.path[2]!.groups!.realEstate.balance).toBe(0);
    expect(sim.path[3]!.groups!.realEstate.balance).toBe(100_000);
    expect(sim.path[3]!.groups!.realEstate.deposits).toBe(100_000);
    expect(sim.path[3]!.groups!.realEstate.growth).toBe(0);
    expect(sim.path[15]!.groups!.realEstate.balance).toBeCloseTo(112_000, 6);
    expect(sim.path[15]!.netWorth).toBeCloseTo(112_000, 6);
  });
});

describe('simulate granularity: year', () => {
  it('one entry per plan year: the monthly balances at year ends, flows summed in month order', () => {
    // asOf 2026-11, 26 months: plan years 2026 (Nov–Dec, months 1–2), 2027 (3–14), 2028 (15–26).
    const p: Profile = {
      ...profile({ pay: 3000, other: 2600, cash: 500, asOf: '2026-11' }),
      debts: [{ id: 'd1', kind: 'personal', balance: 2000, apr: 0.12, minPayment: { value: 300, isEstimate: false } }],
    };
    const opts = { shortfallMode: 'separate' as const, balances: { investments: 1000 }, withdrawalOrder: ['investments' as const] };
    const monthly = simulate(p, 26, opts).path;
    const yearly = simulate(p, 26, { ...opts, granularity: 'year' }).path;
    expect(yearly.map((m) => m.month)).toEqual([0, 2, 14, 26]);
    const sum = (from: number, to: number, f: (m: (typeof monthly)[number]) => number) => {
      let s = 0;
      for (let m = from + 1; m <= to; m++) s += f(monthly[m]!);
      return s;
    };
    for (const [i, [from, to]] of [[0, 2], [2, 14], [14, 26]].entries()) {
      const y = yearly[i + 1]!;
      expect(y.netWorth).toBe(monthly[to]!.netWorth);
      expect(y.shortfall).toBe(monthly[to]!.shortfall);
      expect(y.debts).toEqual(monthly[to]!.debts);
      expect(y.groups!.investments.balance).toBe(monthly[to]!.groups!.investments.balance);
      expect(y.income).toBe(sum(from!, to!, (m) => m.income));
      expect(y.debtPayments).toBe(sum(from!, to!, (m) => m.debtPayments));
      expect(y.groups!.investments.withdrawals).toBe(sum(from!, to!, (m) => m.groups!.investments.withdrawals));
      expect(y.shortfallAdded).toBe(sum(from!, to!, (m) => m.shortfallAdded!));
      expect(y.debtFlows!.d1!.interest).toBe(sum(from!, to!, (m) => m.debtFlows!.d1!.interest));
    }
    // Interest of month 1 on the opening 2000 at 12% / 12 = 20.
    expect(monthly[1]!.debtFlows!.d1).toEqual({ interest: 20, borrowed: 0 });
  });
});

describe('simulate plan options: per-year rates', () => {
  it('constant arrays reproduce the constant-rate run', () => {
    const p = profile({ pay: 4000, other: 2500, cash: 3000, retirement: 20_000, share: 0.4 });
    const rates = { inflationAnnual: 0.031, cashYieldAnnual: 0.025, returnAnnualNominal: 0.065 };
    const opts = { rates, balances: { investments: 8000, realEstate: 250_000, vehicle: 15_000, otherAsset: 2000 } };
    const flat = simulate(p, 36, opts);
    const arrays = simulate(p, 36, {
      ...opts,
      yearlyRates: {
        inflation: [0.031, 0.031, 0.031],
        growth: { cash: [0.025, 0.025, 0.025], retirement: [0.065, 0.065, 0.065], investments: [0.065, 0.065, 0.065] },
      },
    });
    for (const [m, month] of arrays.path.entries()) {
      expect(month.netWorth).toBeCloseTo(flat.path[m]!.netWorth, 6);
      expect(month.income).toBeCloseTo(flat.path[m]!.income, 9);
      expect(month.spending).toBeCloseTo(flat.path[m]!.spending, 9);
      expect(month.groups!.realEstate.balance).toBeCloseTo(flat.path[m]!.groups!.realEstate.balance, 6);
    }
  });

  it('inflation and growth change by plan year (12-month blocks without asOf)', () => {
    // Year 0: inflation 0, investments 10%; year 1: inflation 10%, investments 20%.
    // Shortfall: year 0 adds 1000 a month at flat prices → 12000 at month 12. In year 1 it grows
    // 1.1^(1/12) a month and month 12 + k (k = 0..11) adds 1000 × 1.1^(k/12), which then grows for
    // 11 − k months: at month 24 = 12000 × 1.1 + 12 × 1000 × 1.1^(11/12).
    // Investments 1000 × 1.1 × 1.2 = 1320; otherAsset follows inflation: 1000 × 1.0 × 1.1 = 1100.
    const sim = simulate(profile({ pay: 0, other: 1000 }), 24, {
      rates: ZERO, shortfallMode: 'separate', balances: { investments: 1000, otherAsset: 1000 },
      yearlyRates: { inflation: [0, 0.1], growth: { investments: [0.1, 0.2] } },
    });
    expect(sim.path[12]!.shortfall).toBe(12_000);
    expect(sim.path[13]!.spending).toBe(1000);
    expect(sim.path[24]!.spending).toBeCloseTo(1000 * 1.1 ** (11 / 12), 9);
    expect(sim.path[24]!.shortfall).toBeCloseTo(12_000 * 1.1 + 12_000 * 1.1 ** (11 / 12), 6);
    expect(sim.path[12]!.groups!.investments.balance).toBeCloseTo(1100, 9);
    expect(sim.path[24]!.groups!.investments.balance).toBeCloseTo(1320, 9);
    expect(sim.path[24]!.groups!.otherAsset.balance).toBeCloseTo(1100, 9);
    // Income follows the inflation path (no incomeGrowthAnnual given): month 24 = 1000 × 1.1^(11/12).
    const pay = simulate(profile({ pay: 1000 }), 24, { rates: ZERO, yearlyRates: { inflation: [0, 0.1] } });
    expect(pay.path[13]!.income).toBe(1000);
    expect(pay.path[24]!.income).toBeCloseTo(1000 * 1.1 ** (11 / 12), 9);
  });

  it('plan years are calendar years from asOf', () => {
    // asOf 2026-11: year 0 = Nov + Dec (t = 0, 1), year 1 starts in January (t = 2).
    // Prices: t = 0, 1, 2 at 1000 (two months at 0%); t = 3 at 1000 × 1.1^(1/12).
    const sim = simulate(profile({ pay: 0, other: 1000, asOf: '2026-11' }), 4, {
      rates: ZERO, shortfallMode: 'separate', yearlyRates: { inflation: [0, 0.1] },
    });
    expect(sim.path.slice(1, 4).map((m) => m.spending)).toEqual([1000, 1000, 1000]);
    expect(sim.path[4]!.spending).toBeCloseTo(1000 * 1.1 ** (1 / 12), 9);
  });

  it('rejects arrays that do not cover every plan year, and rates ≤ −1', () => {
    const p = profile({ pay: 1000 });
    // 13 months without asOf = 2 plan years.
    expect(() => simulate(p, 13, { yearlyRates: { inflation: [0.03] } })).toThrow(RangeError);
    expect(() => simulate(p, 12, { yearlyRates: { growth: { investments: [-1] } } })).toThrow(RangeError);
    expect(() => simulate(p, 12, { growth: { vehicle: Number.NaN } })).toThrow(RangeError);
  });
});
