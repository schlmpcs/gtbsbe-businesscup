// S14 Monthly check-in: one month of spending against the plan, and where it leaves the user's number.
// Additive contract (no API route reads or writes it yet): the browser keeps saved check-ins in its own
// store. Every amount is computed by @lifeguessr/engine (simulateMonth, checkinRecord, checkinSummary).
import { z } from 'zod';
import type { CostCategory, ForecastPoint, Money } from './index';
import type { GoalStatus } from './goal';
import { CostCategorySchema, MoneySchema, MonthSchema } from './schemas';

/** End-of-month balances (cash and retirement, and each debt by id). */
export type CheckinBalances = { cash: Money; retirement: Money; debts: Record<string, Money> };

/**
 * One month of spending made up by the engine from the profile (seeded, bounded noise per category).
 * `simulated: true` always: no bank or statement data is behind it, and the screen says so.
 */
export type SimulatedMonth = {
  /** 1 = the first month after today, 2 = the one after, … */
  monthIndex: number;
  simulated: true;
  /** What the forecast assumed for each category this month (the profile's monthly values). */
  planned: Record<CostCategory, Money>;
  /** What the simulated month "spent" per category (monthly). */
  totals: Record<CostCategory, Money>;
};

/** A check-in: the month, its spending against the plan and where it left the balances and the number. */
export type CheckinRecord = {
  /** Calendar month checked in, 'YYYY-MM'. */
  month: string;
  monthIndex: number;
  simulated: true;
  planned: Record<CostCategory, Money>;
  totals: Record<CostCategory, Money>;
  /** Balances at the end of the month, after the spending in `totals`. */
  balances: CheckinBalances;
  /** Net worth at the end of the month (a balance). */
  netWorth: Money;
  /** Net worth 10 years after the month, today's dollars (rules forecast, mid). */
  number10y: Money;
  /** End-of-month net worth minus what the forecast expected for it (positive = ahead). */
  vsForecast: Money;
  /** Σ debt balances at the start of the month minus at its end. */
  debtPaidDown: Money;
  /** ISO 8601 time the check-in was saved; absent until it is. */
  savedAt?: string;
};

export type CheckinRow = { category: CostCategory; forecast: Money; actual: Money };

/** What the committed move did, as far as the check-ins show it. */
export type CheckinMoveProgress =
  | {
      kind: 'debtPayoff';
      debtId: string;
      /** Balance when the check-ins started (the profile's balance today). */
      startBalance: Money;
      /** Balance after the latest month. */
      balance: Money;
      /** startBalance − balance, floored at 0. */
      paid: Money;
      /** paid / startBalance, 0–1 (1 when the start balance was 0). */
      share: number;
      /** Months from the latest month until the debt is paid off (null = not within 10 years). */
      payoffMonths: number | null;
    }
  | {
      kind: 'spendingTarget';
      category: CostCategory;
      /** The move's monthly target. */
      target: Money;
      /** The latest month's spending in the category. */
      actual: Money;
      onTrack: boolean;
    };

export type CheckinSummary = {
  /** Categories with a plan or spending this month (debtPayments is informational and left out). */
  rows: CheckinRow[];
  forecastTotal: Money;
  actualTotal: Money;
  number: {
    /** Net worth now: after the month under review, or today's balance sheet without one. */
    today: Money;
    /** Net worth 10 years on, today's dollars (rules forecast). */
    in10y: ForecastPoint;
    /** The number at the last saved check-in, or before any check-in (today's profile). */
    previous10y: Money;
    /** in10y.mid − previous10y. */
    change10y: Money;
  };
  goal: GoalStatus | null;
  move: CheckinMoveProgress | null;
  /** Totals over the saved check-ins; null when none is saved. */
  value: {
    checkins: number;
    debtPaidDown: Money;
    vsForecast: Money;
    /** Latest saved number10y − the number before the first check-in. */
    numberChange: Money;
  } | null;
};

const CategoryMoneySchema = z.record(CostCategorySchema, MoneySchema);

export const CheckinBalancesSchema = z.object({
  cash: MoneySchema,
  retirement: MoneySchema,
  debts: z.record(z.string().min(1), MoneySchema),
});

export const CheckinRecordSchema = z.object({
  month: MonthSchema,
  monthIndex: z.number().int().min(1),
  simulated: z.literal(true),
  planned: CategoryMoneySchema,
  totals: CategoryMoneySchema,
  balances: CheckinBalancesSchema,
  netWorth: z.number().finite(),
  number10y: z.number().finite(),
  vsForecast: z.number().finite(),
  debtPaidDown: z.number().finite(),
  savedAt: z.iso.datetime().optional(),
});
