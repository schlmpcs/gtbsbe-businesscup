// Value lists for the unions in ./index.ts (runtime iteration, zod enums). Each `satisfies` line
// fails to compile if a member is misspelled; schemas.test.ts checks that none is missing.
import type {
  AreaData, Benchmark, BenchmarkLine, Cadence, ClientFunnelEvent, ClueId, CostCategory, Debt, EventsErrorCode,
  FunnelEventName, KidAge, MissBucket, MoveKind, OverpayingResult, PayoffMethod, ProErrorCode, ProPlan, ProSource,
  ServerFunnelEvent, ServiceCategory, SessionErrorCode, StatementCategorizeResponse, StatementClass,
  SubscriptionFinding, SubscriptionFlag, ToolId,
} from './index';

export const COST_CATEGORIES = [
  'rentUtilities', 'car', 'childcare', 'groceries',
  'eatingOut', 'subscriptions', 'debtPayments', 'other',
] as const satisfies readonly CostCategory[];
export const KID_AGES = ['infant', 'toddler', 'preschool', 'schoolAge'] as const satisfies readonly KidAge[];
export const CLUE_IDS = ['garage', 'kidsRoom', 'kitchen', 'entry', 'mailbox'] as const satisfies readonly ClueId[];
export const AREA_TIERS = ['cheap', 'mid', 'expensive', 'suburb'] as const satisfies readonly AreaData['tier'][];
export const DEBT_KINDS = ['card', 'auto', 'student', 'personal', 'bnpl', 'mortgage'] as const satisfies readonly Debt['kind'][];
export const MOVE_KINDS = [
  'payCardFirst', 'cutCategory', 'cancelSubscriptions',
  'retirementMatch', 'hsa', 'refinance', 'negotiateRent', 'reshopInsurance',
] as const satisfies readonly MoveKind[];

// ----- statements (T6/T7) ---------------------------------------------------------------------

export const STATEMENT_CLASSES = [
  'rentUtilities', 'car', 'childcare', 'groceries',
  'eatingOut', 'subscriptions', 'debtPayments', 'other',
  'pay', 'transfer',
] as const satisfies readonly StatementClass[];
export const CATEGORIZED_BY = ['ai', 'rules', 'mixed'] as const satisfies readonly StatementCategorizeResponse['categorizedBy'][];
/** Most lines one /api/statement/categorize request may carry (years of a busy checking account). */
export const MAX_STATEMENT_ITEMS = 5_000;

// ----- Pro (S15, the paywall demo) -----------------------------------------------------------

export const PRO_PLANS = ['yearly', 'monthly'] as const satisfies readonly ProPlan[];
export const PRO_SOURCES = ['stripe_test', 'demo_checkout', 'demo'] as const satisfies readonly ProSource[];
export const PRO_ERROR_CODES = [
  'bad_request', 'too_large', 'rate_limited', 'unavailable', 'upstream_error',
  'not_paid', 'session_mismatch', 'invalid_code',
] as const satisfies readonly ProErrorCode[];

/**
 * What Pro costs: US dollars per billing interval. A pricing assumption (docs/PRODUCT.md →
 * Business model), so the UI labels it as such. The Stripe Checkout amount and every price the
 * UI shows come from here, so they cannot drift apart.
 */
export const PRO_PRICES = {
  yearly: { amount: 39.99, interval: 'year' },
  monthly: { amount: 6.99, interval: 'month' },
} as const satisfies Record<ProPlan, { amount: number; interval: 'year' | 'month' }>;

// ----- Sessions (T4) -------------------------------------------------------------------------

export const SESSION_ERROR_CODES = [
  'bad_request', 'too_large', 'rate_limited', 'unavailable', 'not_paid',
] as const satisfies readonly SessionErrorCode[];
/** Most purchases one saved wishlist may hold. */
export const SESSION_WISHLIST_MAX = 50;

// ----- Funnel events (T8) --------------------------------------------------------------------

/** Events a browser may send to POST /api/events. */
export const CLIENT_EVENT_NAMES = [
  'play_started', 'clue_opened', 'home_guessed', 'game_finished', 'result_shared',
  'own_guess_submitted', 'closest_life_chosen', 'sliders_adjusted', 'balance_sheet_edited',
  'statement_applied', 'forecast_viewed', 'move_committed', 'afford_checked', 'loan_compared',
  'paywall_viewed',
  // Micro-tools (M1). Appended, so the order of the names above does not change.
  'tool_opened', 'subs_started', 'subs_revealed', 'subs_flagged', 'subs_cancel_marked', 'renewals_exported',
  'overpaying_checked', 'payoff_planned',
] as const satisfies readonly ClientFunnelEvent['name'][];
/** Events only the server records (the Pro routes). */
export const SERVER_EVENT_NAMES = [
  'checkout_started', 'pro_purchased', 'pro_demo_purchased', 'pro_promo_redeemed',
] as const satisfies readonly ServerFunnelEvent['name'][];
export const FUNNEL_EVENT_NAMES = [...CLIENT_EVENT_NAMES, ...SERVER_EVENT_NAMES] as const satisfies readonly FunnelEventName[];
/**
 * The funnel, in order (docs/PRODUCT.md → Metrics to show): play → finished game → guessed own
 * cost → sliders → balance sheet → statement upload → forecast → saw paywall → paid.
 */
export const FUNNEL_STEPS = [
  'play_started', 'game_finished', 'own_guess_submitted', 'sliders_adjusted', 'balance_sheet_edited',
  'statement_applied', 'forecast_viewed', 'paywall_viewed', 'pro_purchased',
] as const satisfies readonly FunnelEventName[];
export const EVENTS_ERROR_CODES = [
  'bad_request', 'too_large', 'rate_limited', 'unavailable',
] as const satisfies readonly EventsErrorCode[];
/** Most events one POST /api/events may carry. */
export const EVENTS_BATCH_MAX = 25;
/** Longest window GET /api/events/funnel reports on, in days. */
export const FUNNEL_MAX_DAYS = 90;
/** Most homes in one day's set: the bound on `home` in event props. */
export const EVENT_HOMES_MAX = 10;
/** Largest count an event prop may carry (findings flagged or marked to cancel): a bound, not a target. */
export const EVENT_COUNT_MAX = 100;

// ----- Micro-tools (M1) ------------------------------------------------------------------------

export const TOOL_IDS = ['subscriptions', 'overpaying', 'payoff'] as const satisfies readonly ToolId[];
/** Guess ÷ actual, lowest first: under 0.5, 0.5 to 0.8, 0.8 to 1.25, 1.25 to 2, over 2. */
export const MISS_BUCKETS = ['under0.5', '0.5to0.8', '0.8to1.25', '1.25to2', 'over2'] as const satisfies readonly MissBucket[];

export const CADENCES = ['monthly', 'quarterly', 'yearly'] as const satisfies readonly Cadence[];
/** Months in one billing period of each cadence: `monthly` = amount ÷ this, `yearly` = amount × 12 ÷ this. */
export const CADENCE_MONTHS = { monthly: 1, quarterly: 3, yearly: 12 } as const satisfies Record<Cadence, number>;
export const SERVICE_CATEGORIES = [
  'video', 'music', 'software', 'cloud', 'fitness', 'news', 'gaming', 'learning', 'food', 'other',
] as const satisfies readonly ServiceCategory[];
export const SUBSCRIPTION_FLAGS = ['priceUp', 'introEnded', 'overlap', 'seenOnce'] as const satisfies readonly SubscriptionFlag[];
export const SUBSCRIPTION_CONFIDENCES = ['high', 'medium', 'low'] as const satisfies readonly SubscriptionFinding['confidence'][];
export const SUBSCRIPTION_STATUSES = ['active', 'stopped'] as const satisfies readonly SubscriptionFinding['status'][];
export const SUBSCRIPTION_ORIGINS = ['statement', 'tickList'] as const satisfies readonly SubscriptionFinding['origin'][];

export const BENCHMARK_LINES = ['rent', 'carInsurance', 'groceries', 'childcare'] as const satisfies readonly BenchmarkLine[];
export const BENCHMARK_POSITIONS = ['below', 'inRange', 'above'] as const satisfies readonly Benchmark['position'][];
export const OVERPAYING_COVERAGES = ['exact', 'metro', 'none'] as const satisfies readonly OverpayingResult['coverage'][];
export const OVERPAYING_SKIP_REASONS = ['noData', 'notEntered'] as const satisfies readonly OverpayingResult['skipped'][number]['reason'][];

export const PAYOFF_METHODS = ['avalanche', 'snowball', 'minimum'] as const satisfies readonly PayoffMethod[];
/**
 * Longest payoff timeline, in months after month 0: the engine's MAX_SIMULATION_MONTHS (packages/engine/loan/amortize.ts).
 * This package cannot import the engine, so keep the two equal by hand.
 */
export const PAYOFF_TIMELINE_MAX_MONTHS = 1_200;

/** Longest id (catalogue slug, finding id, debt id) the micro-tool schemas accept. */
export const MAX_ID_LENGTH = 100;
