// View-model types for S14 Monthly check-in. ui/ may import only this file, @/ui-kit/** and @/copy.
// Hook: useCheckin() in ./useCheckin.ts. Every number is computed by @lifeguessr/engine
// (simulateMonth, checkinRecord, checkinSummary, goalStatus, forecast); none is typed in or made up.
import type { CheckinMoveProgress, CheckinRow, CostCategory, Debt, GoalVerdict, Money, MoveKind } from '@lifeguessr/types';
import type { Loadable } from '@/lib/model/types';

export type { Loadable, VMError } from '@/lib/model/types';
export type { CheckinMoveProgress, CheckinRow, CostCategory, GoalVerdict, Money, MoveKind } from '@lifeguessr/types';

/** The simulated month on screen (not saved yet, or the last one saved). */
export type CheckinMonthVM = {
  /** 'YYYY-MM' */
  month: string;
  /** Always true until a bank connection exists: the screen labels it "Simulated month". */
  simulated: true;
  rows: CheckinRow[];
  forecastTotal: Money;
  actualTotal: Money;
  /** Already in the saved history. */
  saved: boolean;
};

export type CheckinNumberVM = {
  /** Net worth now (after the month on screen, or today's balance sheet). */
  today: Money;
  /** Net worth 10 years on, today's dollars, mid of the range (rules forecast). */
  in10y: Money;
  low: Money;
  high: Money;
  /** Calendar year 10 years after the month on screen. */
  horizonYear: number;
  /** Change since the last saved check-in (or since before the first one). */
  change10y: Money;
  /** Whether there is a month to compare (false before the first fast-forward). */
  hasChange: boolean;
  /** Who made the number: always the rules engine here. */
  source: 'rules';
  /** Some input behind the number is an estimate. */
  isEstimate: boolean;
};

export type CheckinGoalVM = {
  target: Money;
  /** Calendar year the goal is for. */
  year: number;
  projected: Money;
  /** target − projected (positive = short). */
  gap: Money;
  /** projected / target, 0–1 for the bar (the raw value can be above 1). */
  progress: number;
  verdict: GoalVerdict;
};

export type CheckinMoveVM = {
  kind: MoveKind;
  category?: CostCategory;
  /** The debt's kind, for a payoff move (names it: "Credit card"). */
  debtKind?: Debt['kind'];
  progress: CheckinMoveProgress | null;
};

export type CheckinValueVM = { checkins: number; debtPaidDown: Money; vsForecast: Money; numberChange: Money };

export type CheckinHistoryRowVM = { month: string; number10y: Money; change: Money };

export type CheckinVM = {
  status: 'loading' | 'ready';
  /** The month the next fast-forward makes, 'YYYY-MM'. */
  nextMonth: string;
  /** The month on screen; null before the first fast-forward. */
  current: CheckinMonthVM | null;
  /** False while an unsaved month is on screen (save it first), or for a free user who already has one. */
  canFastForward: boolean;
  fastForward: () => void;
  number: Loadable<CheckinNumberVM>;
  /** Pro: goal progress (null = no goal set). Free users get null and `pro.locked`. */
  goal: Loadable<CheckinGoalVM | null>;
  /** The committed move and how far it got; null without one. */
  move: CheckinMoveVM | null;
  /** Pro: the sum over saved check-ins; null when none is saved (or free). */
  value: CheckinValueVM | null;
  /** Pro: saved check-ins, newest first. */
  history: CheckinHistoryRowVM[];
  canSave: boolean;
  save: () => void;
  /** The month just saved, for the confirmation line. */
  justSaved: string | null;
  /** Download the monthly reminder (.ics). */
  downloadCalendar: () => void;
  pro: {
    isPro: boolean;
    /** The Pro status has been answered (cache or server): until then, nothing locked is shown as locked. */
    known: boolean;
    href: string;
  };
  /** Where "Set a goal" and "Pick a move" go (S10). */
  futureHref: string;
};
