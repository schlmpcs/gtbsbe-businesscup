// Props of the design-preview screens (/preview/*). Static sample data, except S29 (engine loan math
// on the demo profile). These screens are not linked from the app and call no API.

/** One category row of S14's forecast vs actual bars. Unrounded dollars for the month. */
export type CheckinRow = { id: string; label: string; forecast: number; actual: number };

/** One simulated month of S14. */
export type CheckinMonth = {
  /** "December 2026". */
  monthLabel: string;
  rows: CheckinRow[];
  forecastTotal: number;
  actualTotal: number;
  move: { name: string; paid: number; total: number; share: number; payoffLabel: string };
  goal: { name: string; saved: number; target: number; share: number; paceLabel: string };
  /** Value check: card paid down so far and how far ahead (+) or behind (−) of forecast. */
  value: { paidDown: number; vsForecast: number };
};

export type CheckinPreviewProps = {
  /** The month the user is in before fast-forwarding ("November 2026"). */
  currentMonthLabel: string;
  /** The months fast-forward steps through, in order. */
  months: CheckinMonth[];
};

export type ProPlanName = 'Yearly' | 'Monthly';

export type ManageProPreviewProps = {
  plan: ProPlanName;
  /** Price in dollars, with its interval label ("per year"). */
  price: number;
  priceInterval: string;
  renewsOn: string;
  /** Pause end date by number of months paused (1, 2, 3). */
  pausedUntil: Record<1 | 2 | 3, string>;
  value: { paidDown: number; vsForecast: number; checkinsSaved: number; goalShare: number; goalName: string };
};

export type MoneyMoment = {
  id: string;
  title: string;
  dateLabel: string;
  /** The user typed this date (lease end, payoff) rather than a fixed calendar date. */
  userDate?: boolean;
  /** The date is a rough window, not exact. */
  isEstimate?: boolean;
  /** What the app helps with on that day, and where. */
  action?: { label: string; href: string };
};

export type CalendarPreviewProps = { moments: MoneyMoment[] };

export type DecisionPath = {
  id: 'A' | 'B';
  termMonths: number;
  apr: number;
  monthly: number;
  totalInterest: number;
  /** 10-year effect on net worth, today's dollars (engine `loan`, rules-based). */
  effect10y: number;
};

export type SharedDecisionPreviewProps = {
  amount: number;
  downPayment: number;
  paths: [DecisionPath, DecisionPath];
  /** Path B's monthly saving and path A's interest saving (both ≥ 0), computed in the model. */
  monthlySaving: number;
  interestSaving: number;
  ctaHref: string;
};

export type LeaderboardRow = { rank: number; handle: string; right: number; points: number; you?: boolean };

export type LeaderboardPreviewProps = {
  dateLabel: string;
  rounds: number;
  /** Static sample countdown, e.g. "9 h 12 min". */
  countdown: string;
  top: LeaderboardRow[];
  you: LeaderboardRow;
  playHref: string;
};
