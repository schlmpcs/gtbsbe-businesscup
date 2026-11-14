import { AvatarFactsSchema } from './avatar';
import { GoalSchema } from './goal';
export { GoalSchema } from './goal';
// Zod schemas for the contracts in ./index.ts. Use them to validate every API input and every
// LLM output (docs/ENGINEERING.md → AI usage rules), and to load fixtures and data files.
//
// Each schema's parsed type is checked against its contract type in schemas.test.ts (both
// directions), so `pnpm typecheck` fails if a contract changes without its schema.
//
// Units follow the contracts: Money = unrounded US dollars, rates = decimals per year.
// Rate schemas reject percent numbers (22.8 instead of 0.228) on purpose: that is the most
// likely LLM/user mistake and it would silently break every forecast.
import { z } from 'zod';
import {
  AREA_TIERS, CATEGORIZED_BY, CLUE_IDS, COST_CATEGORIES, DEBT_KINDS, DUEL_LETTERS, DUEL_ROUNDS, EVENT_HOMES_MAX, EVENTS_BATCH_MAX, EVENTS_ERROR_CODES,
  FUNNEL_EVENT_NAMES, KID_AGES, LIFE_EVENT_ID_MAX_LENGTH, LIFE_EVENT_KINDS, LIFE_EVENT_PRESETS, MAX_LIFE_EVENTS, MAX_STATEMENT_ITEMS, MOVE_KINDS, PRO_ERROR_CODES, PRO_PLANS, PRO_SOURCES,
  SESSION_ERROR_CODES, SESSION_WISHLIST_MAX, STATEMENT_CLASSES,
} from './constants';

// ----- primitives ----------------------------------------------------------------------------

/** US dollars, unrounded. Monthly vs balance is stated on the field that uses it. */
export const MoneySchema = z.number();
/** Non-negative US dollars. */
export const NonNegativeMoneySchema = z.number().min(0);
/** An APR or other interest rate as a decimal per year: 0.228 = 22.8%. Rejects percents (> 1). */
export const AprSchema = z.number().min(0).max(1);
/** A share between 0 and 1 (e.g. retirementShare). */
export const ShareSchema = z.number().min(0).max(1);
/** A year-over-year change as a decimal (e.g. CPI 0.03 = 3%). */
export const ChangeRateSchema = z.number().min(-1).max(1);
/** 'YYYY-MM' */
export const MonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'expected YYYY-MM');
/** A calendar month, 'YYYY-MM' (the `YearMonth` contract). */
export const YearMonthSchema = MonthSchema;
/** 5-digit US ZIP code */
export const ZipSchema = z.string().regex(/^\d{5}$/, 'expected a 5-digit ZIP code');

export const SourceSchema = z.object({
  name: z.string().min(1),
  year: z.number().int().min(1900).max(2100),
  url: z.url().optional(),
});

export const sourced = <T extends z.ZodType>(value: T) =>
  z.object({ value, source: SourceSchema, isEstimate: z.boolean().optional() });

export const estimate = <T extends z.ZodType>(value: T) =>
  z.object({ value, isEstimate: z.boolean() });

export const CostCategorySchema = z.enum(COST_CATEGORIES);
export const KidAgeSchema = z.enum(KID_AGES);
export const AreaTierSchema = z.enum(AREA_TIERS);
export const DebtKindSchema = z.enum(DEBT_KINDS);

// ----- area data and life cards (data pipeline, fixtures) ------------------------------------

const rentSchema = sourced(NonNegativeMoneySchema);

export const AreaDataSchema = z.object({
  zip: ZipSchema,
  metro: z.string().min(1),
  county: z.string().min(1),
  state: z.string().length(2),
  tier: AreaTierSchema,
  rentByBedrooms: z.object({ 0: rentSchema, 1: rentSchema, 2: rentSchema, 3: rentSchema, 4: rentSchema }),
  rentRangeRatio: z.object({
    low: z.number().positive().max(1),
    high: z.number().min(1),
    source: SourceSchema,
  }).optional(),
  childcareMonthly: z.object({
    infant: NonNegativeMoneySchema,
    toddler: NonNegativeMoneySchema,
    preschool: NonNegativeMoneySchema,
    schoolAge: NonNegativeMoneySchema,
    source: SourceSchema,
  }).optional(),
  groceriesPerAdult: sourced(NonNegativeMoneySchema),
  gasPerGallon: sourced(NonNegativeMoneySchema),
  carInsuranceMonthly: sourced(NonNegativeMoneySchema),
  cpiYoY: sourced(ChangeRateSchema),
  // Homeowner fields are optional so area rows from before they existed (and ZIPs the pipeline can't
  // source) stay valid. Rates are decimals per year, so a tax rate written as a percent (1.1) fails here.
  homeValueMedian: sourced(NonNegativeMoneySchema).optional(),
  ownerCostsWithMortgageMonthly: sourced(NonNegativeMoneySchema).optional(),
  ownerCostsWithoutMortgageMonthly: sourced(NonNegativeMoneySchema).optional(),
  propertyTaxRate: sourced(z.number().min(0).max(0.1)).optional(),
  homeInsuranceMonthly: sourced(NonNegativeMoneySchema).optional(),
  homeAppreciationAnnual: sourced(ChangeRateSchema).optional(),
});

export const LifeCardSchema = z.object({
  id: z.string().min(1),
  zip: ZipSchema,
  metro: z.string().min(1),
  adults: z.union([z.literal(1), z.literal(2)]),
  kids: z.array(KidAgeSchema),
  bedrooms: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  car: z.object({
    price: NonNegativeMoneySchema,
    downPayment: NonNegativeMoneySchema,
    apr: AprSchema,
    termMonths: z.number().int().positive().max(120),
  }).optional(),
  eatingOutPerWeek: z.number().min(0).max(50),
  caption: z.string().min(1),
  pack: z.string().min(1).optional(),
});

// ----- profile -------------------------------------------------------------------------------

export const DebtSchema = z.object({
  id: z.string().min(1),
  kind: DebtKindSchema,
  balance: NonNegativeMoneySchema,
  apr: AprSchema,
  minPayment: estimate(NonNegativeMoneySchema),   // monthly
  extraPayment: NonNegativeMoneySchema.optional(), // monthly
});

/** Profile.spending: every category is required (monthly). */
export const SpendingSchema = z.record(CostCategorySchema, estimate(NonNegativeMoneySchema));

// Strict on purpose: an event carries kinds, categories and numbers only, so a typed label (free
// text) is rejected rather than silently dropped (CLAUDE.md rule 6). Whether `month` is in the
// future is the client's to check (it knows today's month); the engine clamps a past one to now.
const lifeEventBase = {
  id: z.string().min(1).max(LIFE_EVENT_ID_MAX_LENGTH),
  month: YearMonthSchema,
  preset: z.enum(LIFE_EVENT_PRESETS).optional(),
};
export const LifeEventSchema = z.discriminatedUnion('kind', [
  z.strictObject({ ...lifeEventBase, kind: z.literal('pay'), takeHomePay: estimate(NonNegativeMoneySchema) }),
  z.strictObject({
    ...lifeEventBase,
    kind: z.literal('spending'),
    category: CostCategorySchema.exclude(['debtPayments']),   // debts are modelled as debts
    monthly: estimate(NonNegativeMoneySchema),
  }),
  z.strictObject({
    ...lifeEventBase,
    kind: z.literal('oneOff'),
    amount: z.number().positive(),
    direction: z.enum(['cost', 'income']),
  }),
]);

export const ProfileSchema = z.object({
  household: AvatarFactsSchema.optional(),
  age: estimate(z.number().int().min(16).max(110)),
  takeHomePay: estimate(NonNegativeMoneySchema),   // monthly
  spending: SpendingSchema,
  cash: estimate(MoneySchema),                     // balance
  retirement: estimate(NonNegativeMoneySchema),    // balance
  retirementShare: estimate(ShareSchema),
  debts: z.array(DebtSchema),
  zip: ZipSchema.optional(),
  committedMoveId: z.string().min(1).optional(),
  doneMoveIds: z.array(z.string().min(1)),
  events: z.array(LifeEventSchema).max(MAX_LIFE_EVENTS).optional(),
  asOf: YearMonthSchema.optional(),
});

export const ProfilePatchSchema = z.object({
  spending: z.partialRecord(CostCategorySchema, NonNegativeMoneySchema).optional(), // monthly
  debts: z.array(z.object({
    id: z.string().min(1),
    extraPayment: NonNegativeMoneySchema.optional(),
    apr: AprSchema.optional(),
  })).optional(),
  retirementShare: ShareSchema.optional(),
});

// ----- forecasts -----------------------------------------------------------------------------

// z.number() already rejects NaN and ±Infinity (zod 4), which is what an LLM answer with a broken
// number needs: schemas.test.ts pins it.
export const ForecastPointSchema = z.object({
  month: z.number().int().min(0), mid: MoneySchema, low: MoneySchema, high: MoneySchema,   // balance
});

/** At least 121 points (months 0..120, so `in10y` exists). Ordering and ranges are checked by the engine. */
export const ForecastSchema = z.object({
  points: z.array(ForecastPointSchema).min(121),
  in10y: ForecastPointSchema,
  todaysDollars: z.boolean(),
});

/**
 * Structure only: the year must be an integer, but the count (10), the order (1, 2, …) and
 * low ≤ mid ≤ high are checked by the engine's `anchorIssues`, which words each problem for the model.
 */
export const YearAnchorSchema = z.object({
  year: z.number().int(),
  low: MoneySchema, mid: MoneySchema, high: MoneySchema,                      // balance
});

export const ForecastSourceSchema = z.enum(['ai', 'rules']);

/** A horizon the forecast picker offers. Kept in step with FORECAST_HORIZONS by schemas.test.ts. */
export const HorizonYearsSchema = z.union([z.literal(1), z.literal(3), z.literal(5), z.literal(10)]);

export const ForecastBundleSchema = z.object({
  source: ForecastSourceSchema,
  model: z.string().optional(),
  base: ForecastSchema,
  scenarios: z.record(z.string(), ForecastSchema),
});

// ----- loans and purchases -------------------------------------------------------------------

export const LoanInputSchema = z.object({
  amount: NonNegativeMoneySchema,
  apr: AprSchema,
  termMonths: z.number().int().positive().max(600),
  fees: NonNegativeMoneySchema.optional(),         // rolled into the loan
  downPayment: NonNegativeMoneySchema.optional(),
  extraPayment: NonNegativeMoneySchema.optional(), // monthly
}).refine((l) => (l.downPayment ?? 0) <= l.amount, {
  message: 'downPayment cannot exceed amount',
  path: ['downPayment'],
});

export const PurchaseSchema = z.object({
  label: z.string().min(1).max(120),
  amount: z.number().positive(),                   // per occurrence
  recurring: z.union([z.literal(false), z.enum(['monthly', 'yearly'])]),
  payWith: z.union([z.enum(['cash', 'card']), z.object({ loan: LoanInputSchema })]),
});

// ----- statements ----------------------------------------------------------------------------

export const StatementItemSchema = z.object({
  label: z.string().min(1).max(200),               // names masked in the browser before sending
  amount: MoneySchema,                             // > 0 = money out, < 0 = money in
  month: MonthSchema,
  day: z.number().int().min(1).max(31),
});

/** Days in a 'YYYY-MM' month (UTC calendar). */
const daysInMonth = (month: string) => {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

export const CategoryTotalsSchema = z.object({
  month: MonthSchema,
  totals: z.record(CostCategorySchema, MoneySchema),
  oneOffs: z.array(z.object({ label: z.string().min(1), amount: MoneySchema })),
  detectedPay: NonNegativeMoneySchema.optional(),  // monthly
  lastDay: z.number().int().min(1).max(31).optional(),  // day of the month's latest statement line
}).refine((m) => m.lastDay === undefined || m.lastDay <= daysInMonth(m.month), {
  message: 'lastDay is past the end of the month',
  path: ['lastDay'],
});

/** A day inside a statement: 'YYYY-MM' and a day that month has. */
export const ChargeDateSchema = z.object({ month: MonthSchema, day: z.number().int().min(1).max(31) })
  .refine((d) => d.day <= daysInMonth(d.month), { message: 'day is past the end of the month', path: ['day'] });

export const StatementClassSchema = z.enum(STATEMENT_CLASSES);

export const StatementCategorizeRequestSchema = z.object({
  items: z.array(StatementItemSchema).min(1).max(MAX_STATEMENT_ITEMS)
    .superRefine((items, ctx) => {
      items.forEach((item, i) => {
        if (item.day > daysInMonth(item.month)) {
          ctx.addIssue({ code: 'custom', path: [i, 'day'], message: `${item.month} has no day ${item.day}` });
        }
      });
    }),
});

export const StatementCategorizeResponseSchema = z.object({
  ok: z.literal(true),
  months: z.array(CategoryTotalsSchema),
  categorizedBy: z.enum(CATEGORIZED_BY),
  classes: z.array(z.object({ label: z.string().min(1).max(200), class: z.enum(STATEMENT_CLASSES) })).optional(),
});

// ----- Pro (S15): requests and responses of /api/pro/* ---------------------------------------
// Shared by the routes and the browser client so the two cannot drift. Failures are
// `{ ok: false, error: { code: ProErrorCode, ... } }`, like the /api/ai/* routes.

export const ProPlanSchema = z.enum(PRO_PLANS);
export const ProSourceSchema = z.enum(PRO_SOURCES);
export const ProErrorCodeSchema = z.enum(PRO_ERROR_CODES);

export const ProStatusSchema = z.discriminatedUnion('pro', [
  z.object({ pro: z.literal(false) }),
  z.object({
    pro: z.literal(true),
    source: ProSourceSchema,
    plan: ProPlanSchema.optional(),                // stripe_test and demo_checkout only
    since: z.iso.datetime(),
  }),
]);

/** POST /api/pro/checkout */
export const ProCheckoutRequestSchema = z.object({ plan: ProPlanSchema });
export const ProCheckoutResponseSchema = z.object({ ok: z.literal(true), url: z.url() });

/**
 * POST /api/pro/confirm: the Checkout Session id Stripe put in the success URL. Test-mode ids
 * only: a live-mode id is rejected here, so no real charge can ever unlock Pro.
 */
export const ProConfirmRequestSchema = z.object({
  sessionId: z.string().regex(/^cs_test_[A-Za-z0-9]{8,200}$/, 'expected a Stripe test-mode Checkout Session id'),
});

/** POST /api/pro/demo-unlock */
export const ProDemoUnlockRequestSchema = z.object({ code: z.string().trim().min(1).max(64) });

/**
 * POST /api/pro/demo-checkout: the simulated checkout. Strict on purpose: the plan is the only
 * thing it takes, so a client that sends card-like fields by mistake is refused, not ignored.
 */
export const ProDemoCheckoutRequestSchema = z.strictObject({ plan: ProPlanSchema });

/** GET /api/pro/status */
export const ProStatusResponseSchema = z.object({
  ok: z.literal(true),
  status: ProStatusSchema,
  /** False when no Stripe test key is configured: the screen then offers only the promo code. */
  checkoutAvailable: z.boolean(),
  /** The promo code is shown on the Pro screen on purpose, so the jury can pass the paywall. */
  demo: z.object({ enabled: z.boolean(), code: z.string().optional() }),
});

/** The reply of POST /api/pro/confirm and POST /api/pro/demo-unlock. */
export const ProMutationResponseSchema = z.object({ ok: z.literal(true), status: ProStatusSchema });

/** Any failed /api/pro/* reply. `retryAfterSeconds` accompanies `rate_limited`. */
export const ProErrorResponseSchema = z.object({
  ok: z.literal(false),
  error: z.object({ code: ProErrorCodeSchema, retryAfterSeconds: z.number().optional() }).loose(),
});

// ----- Sessions (T4): POST /api/session ------------------------------------------------------

/**
 * The anonymous id: `crypto.randomUUID()` in the browser. Lower-cased here, so one id always
 * maps to one saved session whatever case a client sends.
 */
export const AnonIdSchema = z.uuid().transform((id) => id.toLowerCase());

/**
 * POST /api/session: `{ anonId }` alone loads the saved state; with `profile` and/or `wishlist`
 * it replaces those fields (each one whole) and answers the new state. Unknown fields are refused,
 * so nothing is silently dropped.
 */
export const SessionRequestSchema = z.strictObject({
  goal: GoalSchema.nullable().optional(),
  anonId: AnonIdSchema,
  profile: ProfileSchema.optional(),
  wishlist: z.array(PurchaseSchema).max(SESSION_WISHLIST_MAX).optional(),
});

export const SessionStateSchema = z.object({
  goal: GoalSchema.nullable().optional(),
  profile: ProfileSchema.optional(),
  wishlist: z.array(PurchaseSchema),
  revision: z.number().int().min(0),
  updatedAt: z.iso.datetime().nullable(),
});

/** The reply of POST and GET /api/session. */
export const SessionResponseSchema = SessionStateSchema.extend({ ok: z.literal(true) });

export const SessionErrorCodeSchema = z.enum(SESSION_ERROR_CODES);

/** Any failed /api/session reply. `retryAfterSeconds` accompanies `rate_limited`. */
export const SessionErrorResponseSchema = z.object({
  ok: z.literal(false),
  error: z.object({ code: SessionErrorCodeSchema, retryAfterSeconds: z.number().optional() }).loose(),
});

// ----- Duel game (S2/S3): GET /api/daily (duel mode), POST /api/daily/pick, /api/daily/hint ----

export const DuelLetterSchema = z.enum(DUEL_LETTERS);
export const DuelRoundSchema = z.literal(DUEL_ROUNDS);
/** 'YYYY-MM-DD' (the America/New_York date of the set). */
export const DateSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, 'expected YYYY-MM-DD');

export const PublicDuelCardSchema = z.object({
  letter: DuelLetterSchema,
  household: z.string().min(1),
  metro: z.string().min(1),
  caption: z.string(),
  facts: z.array(z.string().min(1)).max(6),
  art: z.string().min(1),
  composite: z.literal(true),
});

export const PublicDuelSchema = z.object({
  date: DateSchema,
  round: DuelRoundSchema,
  kind: z.enum(['life', 'habit']),
  cards: z.tuple([PublicDuelCardSchema, PublicDuelCardSchema]),
});

export const CategoryLineSchema = z.object({
  category: CostCategorySchema,
  amount: NonNegativeMoneySchema,
  sources: z.array(SourceSchema),
  isEstimate: z.boolean(),
});

export const DuelHintSchema = z.object({ A: z.string().min(1), B: z.string().min(1) });

export const PickResultSchema = z.object({
  resultId: z.string().min(1),
  correct: z.boolean(),
  points: z.number().int().min(0),
  totals: z.object({ A: NonNegativeMoneySchema, B: NonNegativeMoneySchema }),
  breakdown: z.object({ A: z.array(CategoryLineSchema), B: z.array(CategoryLineSchema) }),
  decidedBy: z.object({ category: CostCategorySchema, A: NonNegativeMoneySchema, B: NonNegativeMoneySchema }),
  lesson: z.string().min(1),
  crowd: z.object({ pickedA: z.number().int().min(0), total: z.number().int().min(0) }).nullable(),
});

export const DuelPickRequestSchema = z.strictObject({
  anonId: AnonIdSchema, date: DateSchema, round: DuelRoundSchema, choice: DuelLetterSchema,
});
export const DuelHintRequestSchema = z.strictObject({ anonId: AnonIdSchema, date: DateSchema, round: DuelRoundSchema });

// ----- Funnel events (T8): POST /api/events, GET /api/events/funnel --------------------------

const eventId = z.uuid();
const homeIndex = z.number().int().min(1).max(EVENT_HOMES_MAX);
/** An event without props. */
const bare = <N extends string>(name: N) => z.strictObject({ id: eventId, name: z.literal(name) });
/** An event with props (a strict object too). */
const withProps = <N extends string, P extends z.ZodRawShape>(name: N, props: P) =>
  z.strictObject({ id: eventId, name: z.literal(name), props: z.strictObject(props) });

/**
 * One event from the browser. Strict objects with bounded enums, flags and counts only: an
 * unknown name, an extra field or a free-text value is refused, so no personal data gets in.
 */
export const ClientEventEnvelopeSchema = z.discriminatedUnion('name', [
  bare('play_started'),
  withProps('duel_picked', { round: DuelRoundSchema, correct: z.boolean() }),
  withProps('hint_opened', { round: DuelRoundSchema }),
  bare('challenge_copied'),
  bare('own_guess_started'),
  withProps('clue_opened', { home: homeIndex, clue: z.enum(CLUE_IDS) }),
  withProps('home_guessed', { home: homeIndex, cluesOpened: z.number().int().min(0).max(CLUE_IDS.length) }),
  withProps('game_finished', { homes: homeIndex }),
  withProps('result_shared', { via: z.enum(['share', 'copy']) }),
  bare('own_guess_submitted'),
  withProps('closest_life_chosen', { fromToday: z.boolean() }),
  bare('sliders_adjusted'),
  bare('balance_sheet_edited'),
  withProps('statement_applied', { months: z.number().int().min(1).max(120) }),
  bare('forecast_viewed'),
  withProps('move_committed', { kind: z.enum(MOVE_KINDS) }),
  withProps('afford_checked', { verdict: z.enum(['fits', 'wait', 'no']) }),
  withProps('loan_compared', { offers: z.number().int().min(1).max(3) }),
  bare('paywall_viewed'),
  bare('avatar_preview_viewed'),
  bare('avatar_stats_viewed'),
  bare('sample_loaded'),
  withProps('forecast_horizon_changed', { years: HorizonYearsSchema }),
  withProps('life_event_added', { kind: z.enum(LIFE_EVENT_KINDS), preset: z.enum(LIFE_EVENT_PRESETS).optional() }),
  withProps('goal_set', {years:z.number().int().min(1).max(30)}),
  withProps('goal_verdict_shown', {verdict:z.enum(['onTrack','withinRange','behind'])}),
  bare('goal_cleared'),
  withProps('tool_opened', { tool: z.enum(['subscriptions','overpaying','payoff']) }),
  withProps('subs_started', { path: z.enum(['tickList','statement']) }),
  withProps('subs_revealed', { miss: z.enum(['under0.5','0.5to0.8','0.8to1.25','1.25to2','over2']) }),
  withProps('subs_flagged', { count: z.number().int().min(0).max(5000) }),
  withProps('subs_cancel_marked', { count: z.number().int().min(0).max(5000) }),
  bare('renewals_exported'),
  withProps('overpaying_checked', { lines: z.number().int().min(0).max(4), above: z.number().int().min(0).max(4) }),
  withProps('payoff_planned', { method: z.enum(['avalanche','snowball']) }),
]);

/** POST /api/events: 1–EVENTS_BATCH_MAX events for one anonymous id. */
export const EventsRequestSchema = z.strictObject({
  anonId: AnonIdSchema,
  events: z.array(ClientEventEnvelopeSchema).min(1).max(EVENTS_BATCH_MAX),
});

/** `accepted` = events stored by this request; a resent event (same id) is not stored twice. */
export const EventsResponseSchema = z.object({ ok: z.literal(true), accepted: z.number().int().min(0) });

export const EventsErrorCodeSchema = z.enum(EVENTS_ERROR_CODES);

/** Any failed /api/events reply. `retryAfterSeconds` accompanies `rate_limited`. */
export const EventsErrorResponseSchema = z.object({
  ok: z.literal(false),
  error: z.object({ code: EventsErrorCodeSchema, retryAfterSeconds: z.number().optional() }).loose(),
});

export const FunnelEventNameSchema = z.enum(FUNNEL_EVENT_NAMES);

const userCount = z.number().int().min(0);
const share = z.number().min(0).max(1).nullable();

export const FunnelStepSchema = z.object({
  name: FunnelEventNameSchema,
  users: userCount,
  funnel: userCount,
  conversion: share,
});

export const FunnelReportSchema = z.object({
  from: z.iso.datetime(),
  to: z.iso.datetime(),
  users: userCount,
  steps: z.array(FunnelStepSchema),
  events: z.record(FunnelEventNameSchema, userCount),
  tools: z.object({ opened: z.record(z.enum(['subscriptions','overpaying','payoff']), userCount),
    completed: z.record(z.enum(['subscriptions','overpaying','payoff']), userCount),
    rates: z.record(z.enum(['subscriptions','overpaying','payoff']), share) }),
  game: z.object({
    players: userCount,
    finished: userCount,
    finishRate: share,
    guesses: userCount,
    cluesPerHome: z.number().min(0).nullable(),
    blindGuessRate: share,
    shared: userCount,
    shareRate: share,
  }),
});

/** The reply of GET /api/events/funnel. */
export const FunnelResponseSchema = FunnelReportSchema.extend({ ok: z.literal(true) });

export { AvatarPublicSchema,AvatarPreviewSchema,AvatarStatusSchema,AvatarStampSchema,AgeBandSchema } from './avatar';
