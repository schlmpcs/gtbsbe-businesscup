// Props for the tool-screen design previews (S20–S26). Plain data, ready to render; no math in ui/.
import type { Source } from '@lifeguessr/types';

export type { Source };

export type ToolSlug = 'subscriptions' | 'overpaying' | 'payoff' | 'runway' | 'yearly' | 'household';
export type ToolCardVM = { slug: ToolSlug; href: string; minutes: number; accent: 'chart-1' | 'chart-2' | 'chart-3' | 'chart-4' | 'chart-5' | 'primary' };
export type ToolsHubVM = { tools: ToolCardVM[] };

export type SubscriptionRowVM = {
  id: string;
  name: string;
  price: number;
  cadence: 'monthly' | 'yearly';
  tenYear: number;
  goalDays: number;
  isEstimate: boolean;
  source: Source;
  initial: 'keep' | 'cut';
};
export type HabitRowVM = {
  id: string;
  name: string;
  perWeek: number;
  price: number;
  tenYear: number;
  goalDays: number;
  isEstimate: boolean;
  initial: 'keep' | 'half' | 'cut';
};
export type MaybeRowVM = { id: string; label: string; amount: number; months: number };
export type LittleThingsVM = {
  guess: { initial: number; min: number; max: number; step: number };
  actual: number;
  survey: { guessed: number; paid: number };
  maybe: MaybeRowVM[];
  subscriptions: SubscriptionRowVM[];
  habits: HabitRowVM[];
  summary: { count: number; tenYear: number; goalWeeks: number };
};

export type OverpayingLineId = 'rent' | 'groceries' | 'childcare' | 'carInsurance';
export type OverpayingRowVM = {
  line: OverpayingLineId;
  yours: number;
  low: number;
  high: number;
  source: Source;
  isEstimate: boolean;
  position: 'below' | 'inRange' | 'above';
  gapPerMonth: number;
};
export type OverpayingVM = {
  zip: string;
  metro: string;
  bedrooms: 0 | 1 | 2 | 3;
  rows: OverpayingRowVM[];
  summary: { gapPerMonth: number; effect10y: number; goalWeeks: number };
};

export type PayoffDebtVM = { id: string; kind: 'card' | 'auto' | 'student' | 'personal' | 'bnpl' | 'mortgage'; balance: number; apr: number; minPayment: number; isEstimate: boolean };
export type PayoffPlanVM = {
  method: 'avalanche' | 'snowball' | 'minimum';
  debtFreeLabel: string;
  months: number | null;
  totalInterest: number;
  interestSaved: number;
  monthsSooner: number | null;
  order: string[];
};
export type PayoffVM = {
  debts: PayoffDebtVM[];
  extra: number;
  plans: PayoffPlanVM[];
  /** Extra per month (engine solve) to finish by each target month; `initial` is preselected. */
  target: { initial: string; options: { label: string; extra: number; reachable: boolean }[] };
};

export type RunwayVM = {
  cash: number;
  essentials: number;
  months: number;
  targets: { months: 3 | 6; need: number; shortfall: number }[];
  close: { target: 3 | 6; options: { months: number; perMonth: number }[] };
  /** Meter fill share, 0…1. */
  fill: number;
  marks: { months: number; at: number }[];
};

export type YearlyBillVM = { id: string; name: string; amount: number; dueMonth: string; isEstimate: boolean };
export type MonthCellVM = { month: string; bill: number; short: number };
export type YearlyVM = {
  bills: YearlyBillVM[];
  setAside: number;
  without: MonthCellVM[];
  withSetAside: MonthCellVM[];
  firstShort: { month: string; amount: number } | null;
};

export type KidAgeBand = 'infant' | 'toddler' | 'preschool' | 'schoolAge';
export type HouseholdGroup = 'housing' | 'groceries' | 'childcare' | 'car' | 'subscriptions' | 'eatingOut';
export type HouseholdVM = {
  adults: { id: string; role: 'you' | 'partner'; income: number }[];
  kids: { id: string; band: KidAgeBand }[];
  shared: { group: HouseholdGroup; amount: number; shared: boolean }[];
  split: { id: string; role: 'you' | 'partner'; share: number; amount: number }[];
};
