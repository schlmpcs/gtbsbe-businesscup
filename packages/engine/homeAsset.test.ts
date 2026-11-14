// JF4 (#136): the owner's home as an asset in every net worth the engine simulates from a Profile.
// Expected numbers are worked out by hand in the comments.
import { describe, expect, it } from 'vitest';
import type { Account, CostCategory, Debt, PlanAssumptions, Profile, Scenario } from '@lifeguessr/types';
import { COST_CATEGORIES } from '@lifeguessr/types';
import { cloneProfileDemo, profileDemo } from '@lifeguessr/data/fixtures';
import { HOME_ACCOUNT_ID, accountsToProfile, profileToAccounts } from './accounts';
import { netWorthOf } from './avatar';
import { forecastFacts } from './bundle';
import { forecast } from './forecast';
import { level2KindsFor, moveCandidates } from './moves';
import { plan } from './plan';
import { simulate, withHomeAsset } from './simulate';

const exact = (value: number) => ({ value, isEstimate: false });

// A 30-year-old who owns a $300,000 home appreciating 4% a year with a $200,000 30-year mortgage at
// 6%: payment = 200,000 × 0.005 / (1 − 1.005^−360) = $1,199.10 (P&I). Every input is measured.
const MORTGAGE: Debt = { id: 'mortgage-1', kind: 'mortgage', balance: 200_000, apr: 0.06, minPayment: exact(1_199.1010503055138) };
function owner(): Profile {
  const spending = Object.fromEntries(COST_CATEGORIES.map((c) => [c, exact(c === 'other' ? 2_000 : 0)])) as
    Record<CostCategory, { value: number; isEstimate: boolean }>;
  return {
    age: exact(30), takeHomePay: exact(5_000), spending, cash: exact(10_000), retirement: exact(20_000),
    retirementShare: exact(0.2), debts: [{ ...MORTGAGE, minPayment: { ...MORTGAGE.minPayment } }], doneMoveIds: [],
    home: { tenure: 'mortgage', value: exact(300_000), appreciation: exact(0.04), hoaMonthly: 0 },
  };
}
const renterOf = (p: Profile): Profile => { const { home: _home, ...rest } = p; return rest; };

describe('forecast with a home', () => {
  it('a renter is unchanged: no realEstate group, the options object passes through', () => {
    const opts = { balances: { vehicle: 1 } };
    expect(withHomeAsset(profileDemo, opts)).toBe(opts);
    expect(simulate(profileDemo, 12).path[12]!.groups).toBeUndefined();
  });

  it('owner net worth = cash + retirement + home − mortgage, the home growing at its appreciation', () => {
    const p = owner();
    const sim = simulate(p, 120);
    const f = forecast(p);
    const rent = forecast(renterOf(p));
    // Month 0: 10,000 + 20,000 + 300,000 − 200,000 = 130,000.
    expect(f.points[0]!.mid).toBeCloseTo(130_000, 6);
    // The home changes no cash flow, so owner − same profile without the home = the home's value:
    // 300,000 × 1.04^5 = 364,995.87 at month 60, 300,000 × 1.04^10 = 444,073.29 at month 120.
    expect(f.points[60]!.mid - rent.points[60]!.mid).toBeCloseTo(364_995.87072, 4);
    expect(f.in10y.mid - rent.in10y.mid).toBeCloseTo(444_073.2854755, 4);
    expect(sim.path[120]!.groups!.realEstate.balance).toBeCloseTo(444_073.2854755, 4);
    // Paydown builds equity: balance after 120 payments = 200,000 × 1.005^120 − 1,199.10 × (1.005^120 − 1) / 0.005
    // = 167,371.45, so 32,628.55 of principal is repaid.
    expect(sim.path[120]!.debts['mortgage-1']).toBeCloseTo(167_371.4499, 3);
    const m = sim.path[120]!;
    expect(m.netWorth).toBeCloseTo(m.cash + m.retirement + 444_073.2854755 - 167_371.4499, 3);
    // No estimates → no band.
    expect(f.in10y.low).toBe(f.in10y.mid);
    expect(f.in10y.high).toBe(f.in10y.mid);
  });

  it('netWorthOf counts the home, matching month 0', () => {
    expect(netWorthOf(owner())).toBe(130_000);
    expect(netWorthOf(owner())).toBeCloseTo(simulate(owner(), 0).path[0]!.netWorth, 6);
  });
});

describe('moves for an owner', () => {
  it('never offers negotiateRent to an owner; a renter still sees it', () => {
    expect(level2KindsFor(owner())).not.toContain('negotiateRent');
    expect(level2KindsFor(profileDemo)).toContain('negotiateRent');
    expect(moveCandidates(owner()).some((c) => c.kind === 'negotiateRent')).toBe(false);
  });
});

describe('accounts and plan with a home', () => {
  it('profileToAccounts adds one Home account; accountsToProfile gives the same home back', () => {
    const p = owner();
    const accounts = profileToAccounts(p);
    const homes = accounts.filter((a) => a.group === 'realEstate');
    expect(homes).toEqual([{ id: HOME_ACCOUNT_ID, group: 'realEstate', name: 'Home', balance: exact(300_000), growth: 0.04, history: [] }]);
    expect(accountsToProfile(accounts, p).home).toEqual(p.home);
    // An estimated home keeps its flags through the round trip.
    const est = { ...p, home: { ...p.home!, value: { value: 300_000, isEstimate: true }, appreciation: { value: 0.04, isEstimate: true } } };
    expect(accountsToProfile(profileToAccounts(est), est).home).toEqual(est.home);
  });

  it('accountsToProfile: value from included real estate accounts; creates a home only when one exists', () => {
    const p = owner();
    const edited = profileToAccounts(p).map((a): Account => (a.id === HOME_ACCOUNT_ID ? { ...a, balance: exact(350_000) } : a));
    expect(accountsToProfile(edited, p).home!.value).toEqual(exact(350_000));
    // Excluded home account: the home is worth 0 in the profile (it counts nowhere), tenure kept.
    const excluded = edited.map((a) => (a.id === HOME_ACCOUNT_ID ? { ...a, excluded: true } : a));
    expect(accountsToProfile(excluded, p).home).toMatchObject({ tenure: 'mortgage', value: exact(0) });
    // No real estate account at all (accounts from before JF4): the base home is kept as it is.
    expect(accountsToProfile(edited.filter((a) => a.group !== 'realEstate'), p).home).toEqual(p.home);
    // A renter with a real estate account and a mortgage account becomes an owner with a mortgage.
    const renter = renterOf(p);
    expect(accountsToProfile(edited, renter).home).toMatchObject({ tenure: 'mortgage', value: exact(350_000), appreciation: exact(0.04) });
    expect(accountsToProfile(edited.filter((a) => a.group !== 'mortgage'), renter).home!.tenure).toBe('outright');
    expect(accountsToProfile(edited.filter((a) => a.group !== 'realEstate'), renter).home).toBeUndefined();
  });

  it('plan() counts the home once, with or without the Home account', () => {
    const p = { ...owner(), asOf: '2026-01' };
    const a: PlanAssumptions = {
      retireAge: 67, endAge: 32, inflation: 0.03, display: 'future', expenses: { mode: 'budget' }, growth: {},
      withdrawalOrder: ['cash', 'investments', 'retirement'], savingsSplit: [],
    };
    const scenario: Scenario = { id: 's', name: 'Test', assumptions: a, events: [] };
    const renter = renterOf(p);
    const noHome = plan(renter, [], scenario).years;
    const noHomeAccounts = plan(renter, profileToAccounts(renter), scenario).years;
    // The home changes no cash flow, so owner − renter = the home: 300,000 × 1.04 = 312,000 at the end
    // of 2026 and 300,000 × 1.04^2 = 324,480 at the end of 2027, never twice that.
    const fromProfile = plan(p, [], scenario).years;
    const fromAccounts = plan(p, profileToAccounts(p), scenario).years;
    expect(fromProfile[0]!.netWorth - noHome[0]!.netWorth).toBeCloseTo(312_000, 4);
    expect(fromProfile[1]!.netWorth - noHome[1]!.netWorth).toBeCloseTo(324_480, 4);
    expect(fromAccounts[0]!.netWorth - noHomeAccounts[0]!.netWorth).toBeCloseTo(312_000, 4);
    expect(fromAccounts[1]!.netWorth - noHomeAccounts[1]!.netWorth).toBeCloseTo(324_480, 4);
  });
});

describe('forecastFacts with a home', () => {
  it('shows tenure, value and appreciation (not the HOA, already in owner costs); a renter has no home key', () => {
    const facts = forecastFacts({ ...owner(), home: { ...owner().home!, hoaMonthly: 250 } });
    expect(facts.home).toEqual({ tenure: 'mortgage', value: exact(300_000), appreciation: exact(0.04) });
    expect('home' in forecastFacts(cloneProfileDemo())).toBe(false);
  });
});
