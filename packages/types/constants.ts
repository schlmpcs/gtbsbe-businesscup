// Value lists for the unions in ./index.ts (runtime iteration, zod enums). Each `satisfies` line
// fails to compile if a member is misspelled; schemas.test.ts checks that none is missing.
import type {
  AreaData, ClientFunnelEvent, ClueId, CostCategory, Debt, DuelLetter, DuelRound, EventsErrorCode, FunnelEventName, HorizonYears,
  KidAge, LifeEventKind, LifeEventPreset, MoveKind,
  ProErrorCode, ProPlan, ProSource, ServerFunnelEvent, SessionErrorCode, StatementCategorizeResponse, StatementClass, StatementFollowUpKind,
  MissBucket, SubscriptionFinding, SubscriptionFlag,
} from './index';
import type { Cadence } from './subscriptions';

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

// ----- Future life events (S10) ----------------------------------------------------------------

export const LIFE_EVENT_KINDS = ['pay', 'spending', 'oneOff'] as const satisfies readonly LifeEventKind[];
export const LIFE_EVENT_PRESETS = ['raise', 'kid', 'move', 'bigPurchase'] as const satisfies readonly LifeEventPreset[];
/** Most future events one profile may hold. */
export const MAX_LIFE_EVENTS = 12;
/** How far ahead an event may be dated, in years (beyond the 10-year forecast, for longer horizons). */
export const LIFE_EVENT_MAX_YEARS_AHEAD = 30;
/** Longest client-made event id. */
export const LIFE_EVENT_ID_MAX_LENGTH = 64;

/** The horizons the forecast screen's picker offers, shortest first (the default is the last). */
export const FORECAST_HORIZONS = [1, 3, 5, 10] as const satisfies readonly HorizonYears[];

// ----- Duel game (S2/S3) -----------------------------------------------------------------------

export const DUEL_LETTERS = ['A', 'B'] as const satisfies readonly DuelLetter[];
export const DUEL_ROUNDS = [1, 2, 3, 4, 5] as const satisfies readonly DuelRound[];

/**
 * Fewest stored picks a duel round needs before the reveal says how other players picked
 * (PickResult.crowd); below it the crowd is null and the reveal says "Not enough picks yet".
 * "61% picked A" out of five people is noise dressed up as a fact, and with a handful of picks a
 * player could also work out how their friends answered. 20 keeps the line meaningful from the
 * first busy hour of a day. Every stored pick counts, the asking player's own included.
 */
export const DUEL_CROWD_MIN_PICKS = 20;

// ----- statements (T6/T7) ---------------------------------------------------------------------

export const STATEMENT_CLASSES = [
  'rentUtilities', 'car', 'childcare', 'groceries',
  'eatingOut', 'subscriptions', 'debtPayments', 'other',
  'pay', 'transfer',
] as const satisfies readonly StatementClass[];
export const CATEGORIZED_BY = ['ai', 'rules', 'mixed'] as const satisfies readonly StatementCategorizeResponse['categorizedBy'][];
export const STATEMENT_FOLLOW_UP_KINDS = ['merchant', 'cash', 'missing'] as const satisfies readonly StatementFollowUpKind[];
/** Most follow-up questions one statement gets: a few, never a questionnaire. */
export const MAX_STATEMENT_FOLLOW_UPS = 3;
/** Longest follow-up question text the server passes on (the LLM's wording is cut off past it). */
export const MAX_FOLLOW_UP_QUESTION_LENGTH = 160;
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
  'paywall_viewed', 'avatar_preview_viewed', 'avatar_stats_viewed', 'sample_loaded',
  'goal_set', 'goal_verdict_shown', 'goal_cleared', 'forecast_horizon_changed', 'life_event_added',
  'tool_opened', 'subs_started', 'subs_revealed', 'subs_flagged', 'subs_cancel_marked',
  'renewals_exported', 'overpaying_checked', 'payoff_planned',
  'duel_picked', 'hint_opened', 'challenge_copied', 'own_guess_started',
] as const satisfies readonly ClientFunnelEvent['name'][];
/** Events only the server records (the Pro routes). */
export const SERVER_EVENT_NAMES = [
  'avatar_published', 'avatar_unpublished', 'checkout_started', 'pro_purchased', 'pro_demo_purchased', 'pro_promo_redeemed',
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

export const GOAL_MIN_YEARS=1;
export const GOAL_MAX_YEARS=30;
/** Independent tools; never inserted into the main funnel. */
export const TOOL_IDS = ['subscriptions','overpaying','payoff'] as const;


// ----- Subscription audit (M1) -----------------------------------------------------------------
// The catalogue's own lists (cadences, categories) live with its schemas in ./subscriptions.

/**
 * The five buckets of a `subs_revealed` event, guess ÷ actual, lowest first: under 0.5, 0.5 to 0.8, 0.8 to 1.25,
 * 1.25 to 2, over 2. Main declares the `MissBucket` union and writes the same members into the event schema; this
 * is the list to iterate (the union is checked against it in tools.test.ts).
 */
export const MISS_BUCKETS = ['under0.5', '0.5to0.8', '0.8to1.25', '1.25to2', 'over2'] as const satisfies readonly MissBucket[];
export const SUBSCRIPTION_FLAGS = ['priceUp', 'introEnded', 'overlap', 'seenOnce'] as const satisfies readonly SubscriptionFlag[];
export const SUBSCRIPTION_CONFIDENCES = ['high', 'medium', 'low'] as const satisfies readonly SubscriptionFinding['confidence'][];
export const SUBSCRIPTION_STATUSES = ['active', 'stopped'] as const satisfies readonly SubscriptionFinding['status'][];
export const SUBSCRIPTION_ORIGINS = ['statement', 'tickList'] as const satisfies readonly SubscriptionFinding['origin'][];
/** Months in one billing period of each cadence: `monthly` = amount ÷ this, `yearly` = amount × 12 ÷ this. */
export const CADENCE_MONTHS = { monthly: 1, quarterly: 3, yearly: 12 } as const satisfies Record<Cadence, number>;
/**
 * Most findings one SubscriptionAudit may hold. Below the 5,000 a `subs_flagged` or `subs_cancel_marked`
 * event may count (EventsRequestSchema), so every audit that fits the schema can be counted.
 */
export const SUBSCRIPTION_FINDINGS_MAX = 500;
/** Longest id of a finding the schema accepts. */
export const MAX_ID_LENGTH = 100;
/** Most services a person can have ticked in the subscription tool (the tick-list is about 40, with room for more). */
export const SUBSCRIPTION_TICKS_MAX = 200;

export { AVATAR_ROUND_BALANCE,AVATAR_ROUND_MONTHLY,AVATAR_RENT_SHARE_STEP,AVATAR_BOUNDS,AVATAR_TTL_DAYS,AVATAR_MIN_POOL,AVATAR_MIN_PICKS } from './avatar';

/** Exact integer mask capacity shared by JavaScript arithmetic and Postgres bigint queries. */

// ----- Daily spending log (/spend) -------------------------------------------------------------

/** Categories a logged purchase can go in: every CostCategory but the informational debtPayments. */
export const SPEND_ITEM_CATEGORIES = [
  'rentUtilities', 'car', 'childcare', 'groceries', 'eatingOut', 'subscriptions', 'other',
] as const satisfies readonly Exclude<CostCategory, 'debtPayments'>[];
