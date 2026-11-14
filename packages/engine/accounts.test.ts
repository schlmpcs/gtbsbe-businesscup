// MP8 (#168): accounts <-> profile mapping and the net worth summary.
import { describe, expect, it } from 'vitest';
import type { Account, Profile } from '@lifeguessr/types';
import { profileDemo } from '@lifeguessr/data/fixtures';
import { accountsDemo } from '@lifeguessr/data/fixtures/plan';
import { accountsToProfile, netWorthSummary, profileToAccounts } from './accounts';
import { forecast } from './forecast';

const acct = (a: Partial<Account> & Pick<Account, 'id' | 'group'>, value: number, isEstimate = false): Account => ({
  name: a.id,
  balance: { value, isEstimate },
  history: [],
  ...a,
});

describe('netWorthSummary', () => {
  it('net worth = assets − liabilities, excluded accounts skipped', () => {
    const accounts: Account[] = [
      acct({ id: 'c', group: 'cash', history: [{ month: '2026-10', balance: 300 }, { month: '2026-11', balance: 333 }] }, 333),
      acct({ id: 'k', group: 'creditCard', history: [{ month: '2026-10', balance: 200 }, { month: '2026-11', balance: 150 }] }, 150),
      acct({ id: 'v', group: 'vehicle', excluded: true, history: [{ month: '2026-10', balance: 9000 }] }, 10_000),
    ];
    // $333 cash − $150 card = $183; the excluded $10,000 car counts nowhere.
    // A month back (2026-10): $300 − $200 = $100, so change1m = 183 − 100 = 83.
    expect(netWorthSummary(accounts)).toEqual({
      netWorth: 183,
      assets: { total: 333, byGroup: { cash: 333 } },
      liabilities: { total: 150, byGroup: { creditCard: 150 } },
      change1m: 83,
    });

    // Demo accounts: assets 1,300 + 2,500 + 14,500 = 18,300; liabilities 6,400 + 17,800 = 24,200;
    // net worth −5,900 (the excluded $19,500 car skipped). A month back (2026-10): 1,150 + 2,300
    // + 14,500 (401(k) has no October point, so it counts as unchanged) − 6,550 − 18,100 = −6,700,
    // so change1m = −5,900 − (−6,700) = 800.
    const demo = netWorthSummary(accountsDemo);
    expect(demo.netWorth).toBeCloseTo(-5_900, 6);
    expect(demo.assets).toEqual({ total: 18_300, byGroup: { cash: 3_800, retirement: 14_500 } });
    expect(demo.liabilities).toEqual({ total: 24_200, byGroup: { creditCard: 6_400, loan: 17_800 } });
    expect(demo.change1m).toBeCloseTo(800, 6);

    // Only this month's points: no point a month back, so no change.
    expect(netWorthSummary([acct({ id: 'c', group: 'cash', history: [{ month: '2026-11', balance: 333 }] }, 333)]).change1m)
      .toBeNull();
  });
});

describe('accountsToProfile / profileToAccounts mapping per group', () => {
  it('maps every group onto the profile: cash, retirement + investments, liabilities to debts', () => {
    const accounts: Account[] = [
      acct({ id: 'chk', group: 'cash' }, 1_000),
      acct({ id: 'sav', group: 'cash' }, 500, true),
      acct({ id: 'brk', group: 'investments' }, 2_000),
      acct({ id: '401k', group: 'retirement' }, 3_000),
      acct({ id: 'home', group: 'realEstate' }, 400_000),
      acct({ id: 'car', group: 'vehicle' }, 19_000),
      acct({ id: 'art', group: 'otherAsset' }, 1_200),
      acct({ id: 'cc', group: 'creditCard', apr: 0.2, minPayment: { value: 90, isEstimate: false } }, 3_000),
      acct({ id: 'auto', group: 'loan', debtKind: 'auto', apr: 0.07, minPayment: { value: 400, isEstimate: false } }, 15_000),
      acct({ id: 'mtg', group: 'mortgage', apr: 0.06, minPayment: { value: 2_000, isEstimate: false } }, 320_000),
      acct({ id: 'old', group: 'loan', debtKind: 'student', excluded: true, apr: 0.05 }, 9_000),
      acct({ id: 'cash-x', group: 'cash', excluded: true }, 50_000),
    ];
    const p = accountsToProfile(accounts, profileDemo);
    // cash = 1,000 + 500 (the $500 is an estimate, so the sum is too); excluded $50,000 skipped.
    expect(p.cash).toEqual({ value: 1_500, isEstimate: true });
    // retirement = 401(k) 3,000 + investments 2,000.
    expect(p.retirement).toEqual({ value: 5_000, isEstimate: false });
    // Real estate is the home (JF4): the base has none, so one is made with tenure 'mortgage' (there is a
    // mortgage account) and the default appreciation (inflation, an estimate). Vehicle and other assets
    // have no profile field; the excluded student loan is skipped.
    expect(p.home).toEqual({
      tenure: 'mortgage', value: { value: 400_000, isEstimate: false }, appreciation: { value: 0.03, isEstimate: true }, hoaMonthly: 0,
    });
    expect(p.debts).toEqual([
      { id: 'cc', kind: 'card', balance: 3_000, apr: 0.2, minPayment: { value: 90, isEstimate: false } },
      { id: 'auto', kind: 'auto', balance: 15_000, apr: 0.07, minPayment: { value: 400, isEstimate: false } },
      { id: 'mtg', kind: 'mortgage', balance: 320_000, apr: 0.06, minPayment: { value: 2_000, isEstimate: false } },
    ]);
    // Everything the accounts do not describe comes from the base profile.
    const { cash: _c, retirement: _r, debts: _d, home: _h, ...rest } = p;
    const { cash: _bc, retirement: _br, debts: _bd, ...baseRest } = profileDemo;
    expect(rest).toEqual(baseRest);
  });

  it('turns a profile into one account per balance, named by group', () => {
    const p: Profile = {
      ...profileDemo,
      asOf: '2026-11',
      debts: [
        ...profileDemo.debts,
        { id: 'home-1', kind: 'mortgage', balance: 250_000, apr: 0.065, minPayment: { value: 1_580, isEstimate: false } },
      ],
    };
    const h = (balance: number) => [{ month: '2026-11', balance }];
    expect(profileToAccounts(p)).toEqual([
      { id: 'cash', group: 'cash', name: 'Checking', balance: { value: 3_800, isEstimate: false }, history: h(3_800) },
      { id: 'retirement', group: 'retirement', name: 'Retirement', balance: { value: 14_500, isEstimate: true }, history: h(14_500) },
      {
        id: 'card-1', group: 'creditCard', name: 'Credit card', balance: { value: 6_400, isEstimate: false },
        apr: 0.2436, minPayment: { value: 193.92, isEstimate: true }, history: h(6_400),
      },
      {
        id: 'auto-1', group: 'loan', name: 'Auto loan', balance: { value: 17_800, isEstimate: false },
        apr: 0.074, minPayment: { value: 412, isEstimate: false }, debtKind: 'auto', history: h(17_800),
      },
      {
        id: 'home-1', group: 'mortgage', name: 'Mortgage', balance: { value: 250_000, isEstimate: false },
        apr: 0.065, minPayment: { value: 1_580, isEstimate: false }, history: h(250_000),
      },
    ]);
  });
});

describe('accountsToProfile: minimum payment default', () => {
  it('defaults a missing minimum payment from the card formula or amortization and tags it estimate', () => {
    const accounts: Account[] = [
      acct({ id: 'cc', group: 'creditCard', apr: 0.24 }, 6_000),
      acct({ id: 'cc2', group: 'creditCard' }, 6_000),
      acct({ id: 'auto', group: 'loan', debtKind: 'auto', apr: 0.08 }, 18_000),
      acct({ id: 'mtg', group: 'mortgage' }, 300_000),
      acct({ id: 'set', group: 'loan', debtKind: 'personal', apr: 0.1, minPayment: { value: 250, isEstimate: false } }, 5_000),
    ];
    const byId = Object.fromEntries(accountsToProfile(accounts, profileDemo).debts.map((d) => [d.id, d]));
    // Card at 24%: interest 6,000 × 0.24 / 12 = 120, plus 1% of balance 60 → 180.
    expect(byId.cc.minPayment).toEqual({ value: 180, isEstimate: true });
    // Card with no APR: the default 22.36% → 6,000 × 0.2236 / 12 = 111.8, + 60 → 171.8.
    expect(byId.cc2.apr).toBe(0.2236);
    expect(byId.cc2.minPayment.value).toBeCloseTo(171.8, 9);
    expect(byId.cc2.minPayment.isEstimate).toBe(true);
    // Auto loan, 18,000 at 8% over the typical 72 months: r = 0.08 / 12,
    // P·r / (1 − (1 + r)^−72) = 18,000 × 0.0066667 / (1 − 1.0066667^−72) ≈ 315.60.
    expect(byId.auto.minPayment.value).toBeCloseTo(315.5983, 3);
    expect(byId.auto.minPayment.isEstimate).toBe(true);
    // Mortgage with no APR: 6.5% default over 30 years (360 months): 300,000 × r / (1 − (1 + r)^−360) ≈ 1,896.20.
    expect(byId.mtg.apr).toBe(0.065);
    expect(byId.mtg.minPayment.value).toBeCloseTo(1_896.2041, 3);
    expect(byId.mtg.minPayment.isEstimate).toBe(true);
    // A minimum the user typed keeps its value and its flag.
    expect(byId.set.minPayment).toEqual({ value: 250, isEstimate: false });
  });
});

describe('accountsToProfile(profileToAccounts(p), p)', () => {
  it('keeps the demo profile, and so every forecast number, identical', () => {
    const roundTrip = accountsToProfile(profileToAccounts(profileDemo), profileDemo);
    expect(roundTrip).toEqual(profileDemo);
    expect(forecast(roundTrip)).toEqual(forecast(profileDemo));
  });
});
