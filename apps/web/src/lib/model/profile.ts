// Engine calls several screens share: the display forecast, this month's flows, debt-load zones
// and which inputs are estimates. All numbers come from @lifeguessr/engine.
import { debtLoadThresholds, forecast, simulate, type SimulationMonth } from '@lifeguessr/engine';
import { COST_CATEGORIES, type Forecast, type Profile, type Rate } from '@lifeguessr/types';
import { inflationForZip } from '@/lib/areas';
import type { EstimatedField } from './types';

/** Forecast for display: 10 years, area inflation for the profile's ZIP, today's dollars by default. */
export function displayForecast(p: Profile, todaysDollars = true): Forecast {
  return forecast(p, 10, { todaysDollars, rates: { inflationAnnual: inflationForZip(p.zip) } });
}

/**
 * This month's flows from the engine simulation (point inputs): income, spending, debt payments,
 * surplus and debt load for month 1.
 */
export function thisMonth(p: Profile): SimulationMonth {
  return simulate(p, 1, { rates: { inflationAnnual: inflationForZip(p.zip) } }).path[1]!;
}

/** Today's net worth (cash + retirement − debts): the simulation's month-0 entry. */
export function netWorthToday(p: Profile): number {
  return simulate(p, 0).path[0]!.netWorth;
}

export type DebtLoadZone = 'green' | 'yellow' | 'red';

/** Debt-load zone: green < 0.20, yellow 0.20–0.36, red > 0.36 (assumptions: debtLoadThresholds). */
export function debtLoadZone(load: Rate): DebtLoadZone {
  const { yellow, red } = debtLoadThresholds.value;
  if (load > red) return 'red';
  if (load >= yellow) return 'yellow';
  return 'green';
}

/** Gauge data for a debt load: the value, its zone and the thresholds to draw. */
export type DebtLoadGaugeVM = {
  value: Rate;
  zone: DebtLoadZone;
  thresholds: { yellow: Rate; red: Rate };
};

export function debtLoadGauge(load: Rate): DebtLoadGaugeVM {
  return { value: load, zone: debtLoadZone(load), thresholds: { ...debtLoadThresholds.value } };
}

/** Every input the forecast reads that is an estimate, in a stable order. */
export function estimatedFields(p: Profile): EstimatedField[] {
  const out: EstimatedField[] = [];
  for (const field of ['takeHomePay', 'cash', 'retirement', 'retirementShare', 'age'] as const) {
    if (p[field].isEstimate) out.push({ field });
  }
  for (const category of COST_CATEGORIES) {
    if (category !== 'debtPayments' && p.spending[category].isEstimate) out.push({ field: 'spending', category });
  }
  for (const d of p.debts) if (d.minPayment.isEstimate) out.push({ field: 'debtMinPayment', debtId: d.id });
  return out;
}
