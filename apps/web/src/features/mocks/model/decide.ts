// S13 Decision (car example), a mock screen (T11) built on the demo profile with real engine calls:
// forecast() for both paths and payoffOrder() for the months left on the current car loan.
// Only the lease terms below are mock inputs (illustrative, not a quote).
import { applyPatch, forecast, payoffOrder, type ScheduledPurchase } from '@lifeguessr/engine';
import type { Money, Profile } from '@lifeguessr/types';
import { cloneProfileDemo } from '@/fixtures';
import type { DecideVM } from './types';

/** MOCK scenario inputs for the lease path (not sourced; an illustrative example for the preview). */
export const LEASE_SCENARIO = {
  monthly: 489,
  termMonths: 36,
  dueAtSigning: 3000,
  /** Running costs of a newer car (insurance, fuel, upkeep), per month. */
  running: 280,
} as const satisfies Record<string, Money | number>;

/** First year of the demo (the 10-year horizon ends HORIZON_YEARS later). */
export const DEMO_START_YEAR = 2026;
const HORIZON_YEARS = 10;

export function buildDecideVM(profile: Profile = cloneProfileDemo()): DecideVM {
  const auto = profile.debts.find((d) => d.kind === 'auto');
  const loanPayment = auto?.minPayment.value ?? 0;
  const monthsLeft = auto ? payoffOrder([auto], 0, 'avalanche').payoffMonth : 0;

  // Keep: the profile as it is (the loan runs off, then its payment stays in the budget).
  const keep = forecast(profile, HORIZON_YEARS, { todaysDollars: true });

  // Lease: trade the car in (assumed to cover the loan, so the auto debt goes away), pay the lease
  // every month (re-leasing at the end of each term) and the amount due at signing now.
  const leaseProfile = applyPatch(profile, { spending: { car: LEASE_SCENARIO.running } });
  leaseProfile.debts = leaseProfile.debts.filter((d) => d.kind !== 'auto');
  const extra: ScheduledPurchase[] = [
    { label: 'Due at signing', amount: LEASE_SCENARIO.dueAtSigning, recurring: false, payWith: 'cash' },
    { label: 'Lease', amount: LEASE_SCENARIO.monthly, recurring: 'monthly', payWith: 'cash' },
  ];
  const lease = forecast(leaseProfile, HORIZON_YEARS, { todaysDollars: true, extra });

  const keepAdvantage10y = keep.in10y.mid - lease.in10y.mid;
  return {
    horizonYear: DEMO_START_YEAR + HORIZON_YEARS,
    keep: {
      loanLeft: auto?.balance ?? 0,
      monthsLeft,
      loanPayment,
      running: profile.spending.car.value,
      netWorth10y: keep.in10y.mid,
    },
    lease: {
      monthly: LEASE_SCENARIO.monthly,
      termMonths: LEASE_SCENARIO.termMonths,
      dueAtSigning: LEASE_SCENARIO.dueAtSigning,
      running: LEASE_SCENARIO.running,
      netWorth10y: lease.in10y.mid,
    },
    keepAdvantage10y,
    monthlySavingAfterPayoff: LEASE_SCENARIO.monthly + LEASE_SCENARIO.running - profile.spending.car.value,
    better: keepAdvantage10y >= 0 ? 'keep' : 'lease',
    betterBy10y: Math.abs(keepAdvantage10y),
    todaysDollars: keep.todaysDollars,
  };
}
