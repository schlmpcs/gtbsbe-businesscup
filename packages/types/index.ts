// Shared contracts for LifeGuessr. Source of truth: docs/ARCHITECTURE.md → Contracts.
// Change only together (Amir + Aibek): update this file, the zod schemas in ./schemas.ts,
// the fixtures in packages/data/fixtures and both consumers in the same PR.
//
// Units: `Money` is unrounded US dollars, and each field says whether it is **monthly** or a **balance**.
// `Rate` is a decimal per year (`0.228` = 22.8%). The engine returns no user-facing strings;
// the UI maps ids and kinds to `@/copy`.

export type Money = number;   // US dollars, unrounded; monthly vs balance is stated per field
export type Rate = number;    // decimal per year: 0.228 = 22.8%
export type Source = { name: string; year: number; url?: string };
export type Sourced<T> = { value: T; source: Source; isEstimate?: boolean };

export type CostCategory =
  | 'rentUtilities' | 'car' | 'childcare' | 'groceries'
  | 'eatingOut' | 'subscriptions' | 'debtPayments' | 'other';
// In a Profile: `car` = running costs only (insurance, fuel, upkeep); loan payments live in `debts`.
// `debtPayments` is informational (measured from a statement); forecast() takes payments from `debts`, never from here.

export type KidAge = 'infant' | 'toddler' | 'preschool' | 'schoolAge';

export type AreaData = {
  zip: string; metro: string; county: string; state: string;
  tier: 'cheap' | 'mid' | 'expensive' | 'suburb';     // chosen when the ZIPs are picked (DATA.md)
  rentByBedrooms: Record<0|1|2|3|4, Sourced<Money>>;   // monthly GROSS rent (rent + utilities), HUD FMR/SAFMR
  rentRangeRatio?: { low: number; high: number; source: Source }; // ZCTA gross-rent Q1/median and Q3/median
  childcareMonthly?: Record<KidAge, Money> & { source: Source };  // monthly, per child, county
  groceriesPerAdult: Sourced<Money>;                    // monthly
  gasPerGallon: Sourced<Money>;
  carInsuranceMonthly: Sourced<Money>;                  // state average; isEstimate until a source is verified
  cpiYoY: Sourced<Rate>;
};

// Server-side only: holds the answer. The browser never gets a full LifeCard during play.
export type LifeCard = {
  id: string; zip: string; metro: string;
  adults: 1|2; kids: KidAge[]; bedrooms: 0|1|2|3|4;
  car?: { price: Money; downPayment: Money; apr: Rate; termMonths: number };
  eatingOutPerWeek: number; caption: string; pack?: string;
};
export type CostBreakdown = {
  total: { low: Money; mid: Money; high: Money };       // monthly; always low ≤ mid ≤ high
  items: { category: CostCategory; amount: Money; source: Source; isEstimate: boolean }[];
};
export type GuessResult = { points: number; basePoints: number; multiplier: number;
  inRange: boolean; logError: number };               // logError = 0 when in range

// Game scene. Every clue prop is derived from one LifeCard field and maps to one cost line.
export type ClueId = 'garage' | 'kidsRoom' | 'kitchen' | 'entry' | 'mailbox';
export type SceneLayout = 'studio' | '1bed' | '2bed' | '3bed' | '4bed';   // from bedrooms 0–4
export type SceneProp = { sprite: string; room: string; clue?: ClueId };  // no clue = decor, never implies a cost
export type PublicCard = { id: string; metro: string; layout: SceneLayout;  // what the browser gets before guessing
  caption: string; decor: SceneProp[] };
export type ClueReveal = { cardId: string; clue: ClueId; props: SceneProp[];
  facts: Partial<Pick<LifeCard, 'car' | 'kids' | 'eatingOutPerWeek' | 'adults' | 'zip'>> & { tier?: AreaData['tier'] } };
export type GuessReveal = { resultId: string; cost: CostBreakdown; result: GuessResult;
  card: LifeCard; cluesOpened: ClueId[] };

export type Estimate<T> = { value: T; isEstimate: boolean };
export type Debt = { id: string; kind: 'card'|'auto'|'student'|'personal'|'bnpl'|'mortgage';
  balance: Money; apr: Rate;
  minPayment: Estimate<Money>;   // monthly; defaulted from assumptions when the user skips it
  extraPayment?: Money };        // monthly, set by moves
export type Profile = {
  age: Estimate<number>;
  takeHomePay: Estimate<Money>;  // monthly, after tax and payroll retirement contributions
  spending: Record<CostCategory, Estimate<Money>>;      // monthly
  cash: Estimate<Money>; retirement: Estimate<Money>;   // balances
  retirementShare: Estimate<Rate>; // share of a positive monthly surplus saved to retirement
  debts: Debt[]; zip?: string;
  committedMoveId?: string; doneMoveIds: string[];
};
export type ProfilePatch = {
  spending?: Partial<Record<CostCategory, Money>>;
  debts?: { id: string; extraPayment?: Money; apr?: Rate }[];
  retirementShare?: Rate;
};

export type ForecastPoint = { month: number; mid: Money; low: Money; high: Money }; // net worth (balance)
export type Forecast = { points: ForecastPoint[]; in10y: ForecastPoint; todaysDollars: boolean };
  // always simulated for ≥ 120 months; in10y = point at month 120
export type MoveKind = 'payCardFirst' | 'cutCategory' | 'cancelSubscriptions'
  | 'retirementMatch' | 'hsa' | 'refinance' | 'negotiateRent' | 'reshopInsurance';
export type Move = { id: string; kind: MoveKind; level: 1|2|3; category?: CostCategory;
  effect10y: Money; patch: ProfilePatch };
export type MonthEnd = { projectedSpend: Money; vsAverage: Money | null;  // null until ≥ 3 months of history
  drifts: { category: CostCategory; delta: Money }[] };

export type LoanInput = { amount: Money; apr: Rate; termMonths: number;
  fees?: Money; downPayment?: Money; extraPayment?: Money };
  // financed principal = amount − downPayment + fees (fees are rolled into the loan)
export type LoanResult = { monthly: Money; totalInterest: Money; totalCost: Money;
  payoffMonth: number | null;    // null = the payment never covers the interest
  debtLoadBefore: Rate; debtLoadAfter: Rate; effect10y: Money;
  schedule: { month: number; interest: Money; principal: Money; balance: Money }[] };
  // debtLoad = required debt payments / take-home pay; Infinity when there are payments but no pay.

// POST /api/ai/explain (at least one of the two). The loan result travels without its schedule,
// and with a debt load JSON can carry: JSON has no Infinity, so a debt load with no take-home pay
// to measure it against (the engine's Infinity) is sent as null and said in words, never as a number.
export type ExplainLoanResult = Omit<LoanResult, 'schedule' | 'debtLoadBefore' | 'debtLoadAfter'> & {
  debtLoadBefore: Rate | null; debtLoadAfter: Rate | null };   // null = no take-home pay
export type ExplainRequest = { move?: Move; loanResult?: ExplainLoanResult };
export type ExplainResponse = { text: string; source: 'ai' | 'template' };

export type Purchase = { label: string; amount: Money;   // amount per occurrence
  recurring: false | 'monthly' | 'yearly';
  payWith: 'cash' | 'card' | { loan: LoanInput } };
export type AffordResult = { verdict: 'fits'|'wait'|'no'; waitMonths?: number;
  failsOn?: 'cushion' | 'debtLoad' | 'cardRevolves';
  baselineFails: boolean;        // the plan already breaks a rule without this purchase
  with: Forecast; without: Forecast; cheapestWay: 'cash' | 'card' | 'loan' };

// Browser only; never sent. date = 'YYYY-MM-DD'; amount > 0 = money out, < 0 = money in.
export type Transaction = { date: string; description: string; amount: Money };
// The only statement data that leaves the browser. month = 'YYYY-MM'; label has names masked.
export type StatementItem = { label: string; amount: Money; month: string; day: number };
export type CategoryTotals = { month: string; totals: Record<CostCategory, Money>; // month = 'YYYY-MM'
  oneOffs: { label: string; amount: Money }[]; detectedPay?: Money;
  lastDay?: number };
// `totals` exclude `oneOffs`; `detectedPay` = take-home pay deposits that month (money in).
// `lastDay` = day of month of the latest statement line in that month (any line: spending, pay or
// a transfer), i.e. how far into the month the statement goes. Month-end projects the month in
// progress from it. Absent on data saved before it existed: the app then falls back to today.

// How the server sorted one statement line (labels only; every sum is done in code). A CostCategory
// is spending in that category when money goes out, or a refund from that kind of merchant when it
// comes in. 'pay' = take-home pay coming in. 'transfer' = money moved between the user's own
// accounts, or received from a person: neither spending nor pay, so it is left out.
export type StatementClass = CostCategory | 'pay' | 'transfer';
// POST /api/statement/categorize. `categorizedBy`: who sorted the labels: the AI, the keyword
// rules (no API key, provider failure or invalid output), or both (the AI skipped some labels).
export type StatementCategorizeRequest = { items: StatementItem[] };
export type StatementCategorizeResponse = { months: CategoryTotals[]; categorizedBy: 'ai' | 'rules' | 'mixed' };

// ----- Pro (S15): the paywall demo -----------------------------------------------------------
// No real money ever moves. `stripe_test` = Stripe Checkout in test mode; `demo` = the promo code
// shown on the Pro screen (so the jury can pass the paywall without paying). The server is the
// authority on who is Pro; the browser only caches the last answer. Keyed by the anonymous id.
export type ProPlan = 'yearly' | 'monthly';
export type ProSource = 'stripe_test' | 'demo';
export type ProStatus =
  | { pro: false }
  | { pro: true; source: ProSource; plan?: ProPlan; since: string };  // plan: stripe_test only; since: ISO 8601 UTC
export type ProErrorCode =
  | 'bad_request' | 'too_large' | 'rate_limited' | 'unavailable' | 'upstream_error'
  | 'not_paid'            // confirm: the Checkout Session is not complete and paid
  | 'session_mismatch'    // confirm: the session belongs to another anonymous id, or is already claimed
  | 'invalid_code';       // demo-unlock: wrong code, or demo unlock is switched off

// ----- Sessions (T4): POST /api/session ----------------------------------------------------
// The profile and wishlist saved under the anonymous id, so a reload restores them without an
// account. `revision` counts saves (0 = nothing saved yet); `updatedAt` is ISO 8601 UTC.
export type SessionState = { profile?: Profile; wishlist: Purchase[]; revision: number; updatedAt: string | null };
export type SessionErrorCode =
  | 'bad_request' | 'too_large' | 'rate_limited'
  | 'unavailable'         // the store is not configured or cannot be reached (503)
  | 'not_paid';           // the save would add to the wishlist, which is a Pro feature (402)

export * from './constants';
export * from './schemas';
