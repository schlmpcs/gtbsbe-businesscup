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
  oneOffs: { label: string; amount: Money }[]; detectedPay?: Money };

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

// ----- Funnel events (T8): POST /api/events, GET /api/events/funnel -------------------------
// What the app counts to show its funnel (docs/PRODUCT.md → Metrics to show). Names come from a
// fixed list. Props hold only small enums, flags and counts: never text, amounts, ids or anything
// a person typed, so an event cannot carry personal data. Stored under the hash of the anonymous id.
// `home` is the 1-based position of a home in today's set.
export type ClientFunnelEvent =
  | { name: 'play_started' }
  | { name: 'clue_opened'; props: { home: number; clue: ClueId } }
  | { name: 'home_guessed'; props: { home: number; cluesOpened: number } }
  | { name: 'game_finished'; props: { homes: number } }
  | { name: 'result_shared'; props: { via: 'share' | 'copy' } }
  | { name: 'own_guess_submitted' }
  | { name: 'closest_life_chosen'; props: { fromToday: boolean } }
  | { name: 'sliders_adjusted' }
  | { name: 'balance_sheet_edited' }
  | { name: 'statement_applied'; props: { months: number } }
  | { name: 'forecast_viewed' }
  | { name: 'move_committed'; props: { kind: MoveKind } }
  | { name: 'afford_checked'; props: { verdict: AffordResult['verdict'] } }
  | { name: 'loan_compared'; props: { offers: number } }
  | { name: 'paywall_viewed' };
/** Recorded by the server routes themselves (Pro); a browser cannot send them. */
export type ServerFunnelEvent =
  | { name: 'checkout_started'; props: { plan: ProPlan } }
  | { name: 'pro_purchased'; props: { plan: ProPlan } }   // a test-mode Stripe Checkout, confirmed paid
  | { name: 'pro_promo_redeemed' };                        // the jury promo code
export type FunnelEvent = ClientFunnelEvent | ServerFunnelEvent;
export type FunnelEventName = FunnelEvent['name'];
/** One event as the browser sends it: `id` = crypto.randomUUID(), so a resent batch is stored once. */
export type ClientEventEnvelope = ClientFunnelEvent & { id: string };
/** POST /api/events. */
export type EventsRequest = { anonId: string; events: ClientEventEnvelope[] };
export type EventsErrorCode = 'bad_request' | 'too_large' | 'rate_limited' | 'unavailable';
/**
 * One step of the funnel: `users` = distinct anonymous ids that sent this step's event; `funnel` =
 * those that also sent every earlier step's; `conversion` = funnel / the previous step's funnel
 * (null for the first step, or when the previous step has nobody).
 */
export type FunnelStep = { name: FunnelEventName; users: number; funnel: number; conversion: number | null };
/** GET /api/events/funnel: the funnel and the game metrics over [from, to]. Rates are null when nothing was counted. */
export type FunnelReport = {
  from: string; to: string;                       // ISO 8601 UTC
  users: number;                                  // distinct anonymous ids with any event
  steps: FunnelStep[];                            // FUNNEL_STEPS, in order
  events: Record<FunnelEventName, number>;        // distinct anonymous ids per event
  game: {
    players: number; finished: number; finishRate: number | null;
    guesses: number; cluesPerHome: number | null; blindGuessRate: number | null;  // blind = no clue opened
    shared: number; shareRate: number | null;     // share rate = shared / finished
  };
};

export * from './constants';
export * from './schemas';
