// View-model types for the mocks feature (S13–S14, task T11: "clickable on fixtures").
// ui/ may import only this file, @/ui-kit/** and @/copy (lint-enforced). The VMs are built in
// ./decide.ts and ./checkin.ts from fixtures and engine calls.
import type { CostCategory, Money, Rate } from '@lifeguessr/types';

export type { CostCategory } from '@lifeguessr/types';

/** S13: keep the current car (and its loan) vs lease a new one. All money in today's dollars at 2036. */
export type DecideVM = {
  /** Year of the 10-year horizon (month 120). */
  horizonYear: number;
  keep: {
    /** Auto-loan balance today (demo profile). */
    loanLeft: Money;
    /** Months until the loan is paid at its minimum payment (engine payoffOrder); null = never. */
    monthsLeft: number | null;
    /** Required loan payment, per month. */
    loanPayment: Money;
    /** Insurance, fuel, upkeep, per month (demo profile). */
    running: Money;
    /** Net worth at month 120, mid, today's dollars (engine forecast). */
    netWorth10y: Money;
  };
  lease: {
    /** Lease payment, per month (mock scenario input). */
    monthly: Money;
    termMonths: number;
    /** One-off at signing (mock scenario input). */
    dueAtSigning: Money;
    /** Running costs per month (mock scenario input). */
    running: Money;
    netWorth10y: Money;
  };
  /** keep.netWorth10y − lease.netWorth10y (positive = keeping is ahead). */
  keepAdvantage10y: Money;
  /** Lease path car cost per month − keep path car cost per month, once the current loan is paid off. */
  monthlySavingAfterPayoff: Money;
  /** Which path ends ahead at month 120, and by how much (≥ 0). */
  better: 'keep' | 'lease';
  betterBy10y: Money;
  todaysDollars: boolean;
};

export type DriftVM = {
  category: CostCategory;
  /** Projected this month − 3-month average, per month (positive = over). */
  delta: Money;
};

/** S14: the monthly check-in (month-end projection vs the 3-month average, and the committed move). */
export type CheckinVM = {
  /** Month names for the copy ("November check-in", "Add October statement"). */
  monthName: string;
  nextStatementMonthName: string;
  /** Projected spend for this month (engine monthEnd). */
  projected: Money;
  /** 3-month average spend. */
  average: Money;
  /** projected − average (positive = over). */
  difference: Money;
  /** Whole-dollar direction of the difference, for the headline. */
  direction: 'over' | 'under' | 'even';
  /** Categories that drifted, then tiles for categories on track (delta 0). */
  drifts: DriftVM[];
  onTrack: CostCategory[];
  /** The committed move: paying the card down. */
  move: {
    startBalance: Money;
    paid: Money;
    /** paid / startBalance, 0–1. */
    progress: Rate;
    /** Months until the card is paid off at this pace (engine payoffOrder); null = never. */
    monthsLeft: number | null;
  };
  /** Where "Add statement" goes (S9 upload). */
  uploadHref: string;
  /** 'engine' when monthEnd returned an average (T9 landed); 'fixture' when it fell back to the labelled mock values. */
  source: 'engine' | 'fixture';
};
