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
  AREA_TIERS, BENCHMARK_LINES, BENCHMARK_POSITIONS, CADENCE_MONTHS, CADENCES, CATEGORIZED_BY, CLUE_IDS, COST_CATEGORIES,
  DEBT_KINDS, EVENT_COUNT_MAX, EVENT_HOMES_MAX, EVENTS_BATCH_MAX, EVENTS_ERROR_CODES, FUNNEL_EVENT_NAMES, KID_AGES,
  MAX_ID_LENGTH, MAX_STATEMENT_ITEMS, MISS_BUCKETS, MOVE_KINDS, OVERPAYING_COVERAGES, OVERPAYING_SKIP_REASONS,
  PAYOFF_METHODS, PAYOFF_TIMELINE_MAX_MONTHS, PRO_ERROR_CODES, PRO_PLANS, PRO_SOURCES, SERVICE_CATEGORIES,
  SESSION_ERROR_CODES, SESSION_WISHLIST_MAX, STATEMENT_CLASSES, SUBSCRIPTION_CONFIDENCES, SUBSCRIPTION_FLAGS,
  SUBSCRIPTION_FINDINGS_MAX, SUBSCRIPTION_ORIGINS, SUBSCRIPTION_STATUSES, TOOL_IDS,
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

export const ProfileSchema = z.object({
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
  /** Additive (M1): how each distinct masked label was sorted. Optional: older servers do not send it. */
  classes: z.array(z.object({ label: z.string().min(1).max(200), class: StatementClassSchema }))
    .max(MAX_STATEMENT_ITEMS).optional(),
});

// ----- Micro-tools (M1): subscription audit, overpaying check, debt payoff planner ------------
// The schemas the tools and their tests share. Findings and audits are also read back from local
// storage, so they check the whole shape, including the arithmetic a finding must satisfy. An audit's
// totals are only bounded (see SubscriptionAuditSchema), not recomputed.

export const ToolIdSchema = z.enum(TOOL_IDS);
export const MissBucketSchema = z.enum(MISS_BUCKETS);
export const CadenceSchema = z.enum(CADENCES);
export const ServiceCategorySchema = z.enum(SERVICE_CATEGORIES);
export const SubscriptionFlagSchema = z.enum(SUBSCRIPTION_FLAGS);
export const BenchmarkLineSchema = z.enum(BENCHMARK_LINES);
export const PayoffMethodSchema = z.enum(PAYOFF_METHODS);

/** A catalogue slug, a finding id or a debt id: short, never empty. */
const shortId = z.string().min(1).max(MAX_ID_LENGTH);
/** Strictly positive dollars: a price, or the amount of one charge. */
const PositiveMoneySchema = z.number().positive();
/** Money rounded to cents is compared to its exact value within this much. */
const CENT = 0.01;
const hasDuplicates = (values: readonly unknown[]) => new Set(values).size !== values.length;
/** Is calendar day `a` later than `b`? ('YYYY-MM' strings sort in time order.) */
const isAfter = (a: { month: string; day: number }, b: { month: string; day: number }) =>
  a.month > b.month || (a.month === b.month && a.day > b.day);
type Issue = (path: (string | number)[], message: string) => void;
const issuer = (ctx: z.RefinementCtx): Issue => (path, message) => ctx.addIssue({ code: 'custom', path, message });

// ----- subscriptions

export const ServicePlanSchema = z.object({
  id: shortId,
  name: z.string().min(1).max(80),
  price: PositiveMoneySchema,                      // per cadence
  cadence: CadenceSchema,
});

/**
 * Exactly what merchantKey() (packages/engine/statement.ts) outputs: it upper-cases, turns everything
 * outside A-Z into a space, trims and collapses spaces. So a matcher is upper-case words with single
 * spaces; a lower-case or punctuated one could never equal a key. (apps/web's sampleItems.test.ts
 * checks that the key of every line of the sample statement passes.)
 */
const matcherSchema = z.string().max(60).regex(/^[A-Z]+(?: [A-Z]+)*$/, 'expected upper-case words and single spaces only (merchantKey style)');

export const KnownServiceSchema = z.object({
  id: shortId,
  name: z.string().min(1).max(80),
  category: ServiceCategorySchema,
  matchers: z.array(matcherSchema).min(1).max(20),
  ambiguous: z.boolean().optional(),
  plans: z.array(ServicePlanSchema).min(1).max(10),
  priceYear: z.number().int().min(2000).max(2100),
  source: SourceSchema,
  isEstimate: z.boolean(),
}).superRefine((service, ctx) => {
  const issue = issuer(ctx);
  if (hasDuplicates(service.plans.map((p) => p.id))) issue(['plans'], 'plan ids must be unique');
  if (hasDuplicates(service.matchers)) issue(['matchers'], 'matchers must be unique');
});

/** A day inside a statement: 'YYYY-MM' and a day that month has. */
export const ChargeDateSchema = z.object({ month: MonthSchema, day: z.number().int().min(1).max(31) })
  .refine((d) => d.day <= daysInMonth(d.month), { message: 'day is past the end of the month', path: ['day'] });

export const SubscriptionFindingSchema = z.object({
  id: shortId,
  merchantKey: z.string().min(1).max(200),
  label: z.string().min(1).max(200),
  serviceId: shortId.optional(),
  category: ServiceCategorySchema,
  cadence: CadenceSchema,
  amount: PositiveMoneySchema,                     // per cadence
  monthly: PositiveMoneySchema,
  yearly: PositiveMoneySchema,
  chargesSeen: z.number().int().min(0).max(1_000),
  lastCharge: ChargeDateSchema.nullable(),
  nextExpected: ChargeDateSchema.nullable(),
  status: z.enum(SUBSCRIPTION_STATUSES),
  flags: z.array(SubscriptionFlagSchema).max(SUBSCRIPTION_FLAGS.length),
  previousAmount: PositiveMoneySchema.optional(),
  overlapsWith: z.array(shortId).max(50).optional(),
  confidence: z.enum(SUBSCRIPTION_CONFIDENCES),
  origin: z.enum(SUBSCRIPTION_ORIGINS),
  isEstimate: z.boolean(),
}).superRefine((f, ctx) => {
  const issue = issuer(ctx);
  // The normalized figures follow from the amount and the cadence (to the cent).
  const months = CADENCE_MONTHS[f.cadence];
  if (Math.abs(f.monthly - f.amount / months) > CENT / 2 + 1e-9) issue(['monthly'], `expected amount ÷ ${months} (to the cent)`);
  if (Math.abs(f.yearly - (f.amount * 12) / months) > CENT / 2 + 1e-9) issue(['yearly'], `expected amount × ${12 / months} (to the cent)`);
  if (f.origin === 'tickList') {
    // A tick is something the user said they pay for: no charge was seen, and the price is an estimate.
    if (f.chargesSeen !== 0) issue(['chargesSeen'], 'a ticked service has no charges seen');
    if (f.lastCharge !== null) issue(['lastCharge'], 'a ticked service has no last charge');
    if (f.nextExpected !== null) issue(['nextExpected'], 'a ticked service has no next date');
    if (f.status !== 'active') issue(['status'], 'a ticked service is active');
    if (!f.isEstimate) issue(['isEstimate'], 'a ticked service is an estimate');
  } else {
    if (f.chargesSeen < 1) issue(['chargesSeen'], 'a statement finding has at least one charge');
    if (f.lastCharge === null) issue(['lastCharge'], 'a statement finding has a last charge');
  }
  if (f.status === 'stopped' && f.nextExpected !== null) issue(['nextExpected'], 'a stopped finding has no next date');
  if (f.lastCharge && f.nextExpected && !isAfter(f.nextExpected, f.lastCharge)) {
    issue(['nextExpected'], 'next date is not after the last charge');
  }
  if (hasDuplicates(f.flags)) issue(['flags'], 'flags must be unique');
  if (f.flags.includes('priceUp') && (f.previousAmount === undefined || f.previousAmount >= f.amount)) {
    issue(['previousAmount'], 'a price rise needs the lower amount it rose from');
  }
  if (!f.flags.includes('priceUp') && f.previousAmount !== undefined) {
    issue(['previousAmount'], 'a previous amount belongs to the priceUp flag');
  }
  if (f.flags.includes('overlap') && (f.overlapsWith?.length ?? 0) === 0) issue(['overlapsWith'], 'an overlap names the findings it overlaps');
  if (!f.flags.includes('overlap') && (f.overlapsWith?.length ?? 0) > 0) {
    issue(['overlapsWith'], 'a list of overlapping findings belongs to the overlap flag');
  }
  if (f.overlapsWith?.includes(f.id)) issue(['overlapsWith'], 'a finding cannot overlap itself');
  if (f.flags.includes('seenOnce') && f.chargesSeen !== 1) issue(['flags'], 'seenOnce means exactly one charge');
});

export const SubscriptionAuditSchema = z.object({
  findings: z.array(SubscriptionFindingSchema).max(SUBSCRIPTION_FINDINGS_MAX),
  monthlyTotal: NonNegativeMoneySchema,
  yearlyTotal: NonNegativeMoneySchema,
  monthsCovered: z.number().int().min(0).max(600),
  asOf: ChargeDateSchema.nullable(),
}).superRefine((audit, ctx) => {
  const issue = issuer(ctx);
  const ids = audit.findings.map((f) => f.id);
  if (hasDuplicates(ids)) issue(['findings'], 'finding ids must be unique');
  audit.findings.forEach((f, i) => {
    for (const other of f.overlapsWith ?? []) {
      if (!ids.includes(other)) issue(['findings', i, 'overlapsWith'], `${other} is not a finding of this audit`);
    }
  });
  if (audit.findings.length > 0 && audit.asOf === null) issue(['asOf'], 'an audit with findings has an as-of date');
  // "Today" for the audit is the latest day of the statement, so no charge is later than it.
  if (audit.asOf) {
    audit.findings.forEach((f, i) => {
      if (f.lastCharge && isAfter(f.lastCharge, audit.asOf!)) issue(['findings', i, 'lastCharge'], 'a charge is later than the as-of date');
    });
  }
  // Totals are only bounded here, because which findings M3 counts also depends on the confirmations
  // the user has made (a low-confidence finding counts once confirmed). Every active finding that is
  // not low confidence is counted, so the totals are at least their sum; nothing but a finding can be
  // counted, so they are at most the sum of all findings. Each figure may be exact or rounded to the
  // cent, so the bounds give each finding, and the total, half a cent of slack.
  const slack = ((audit.findings.length + 1) * CENT) / 2 + 1e-9;
  const counted = audit.findings.filter((f) => f.status === 'active' && f.confidence !== 'low');
  for (const [total, figure] of [['monthlyTotal', 'monthly'], ['yearlyTotal', 'yearly']] as const) {
    const least = counted.reduce((sum, f) => sum + f[figure], 0);
    const most = audit.findings.reduce((sum, f) => sum + f[figure], 0);
    if (audit[total] < least - slack) issue([total], `less than the active findings that are not low confidence (${figure} sum ${least})`);
    if (audit[total] > most + slack) issue([total], `more than all the findings together (${figure} sum ${most})`);
  }
});

// ----- overpaying

const BenchmarkRangeSchema = z.object({ low: NonNegativeMoneySchema, mid: NonNegativeMoneySchema, high: NonNegativeMoneySchema })
  .refine((r) => r.low <= r.mid && r.mid <= r.high, { message: 'expected low ≤ mid ≤ high' });

export const BenchmarkSchema = z.object({
  line: BenchmarkLineSchema,
  yours: NonNegativeMoneySchema,                   // monthly
  typical: BenchmarkRangeSchema,
  source: SourceSchema,
  isEstimate: z.boolean(),
  position: z.enum(BENCHMARK_POSITIONS),
  gapPerMonth: NonNegativeMoneySchema,
  gapPerYear: NonNegativeMoneySchema,
  effect10y: MoneySchema,                          // can be negative: moving a line up to the mid costs money
}).superRefine((b, ctx) => {
  const issue = issuer(ctx);
  const position = b.yours > b.typical.high ? 'above' : b.yours < b.typical.low ? 'below' : 'inRange';
  if (b.position !== position) issue(['position'], `${b.yours} against ${b.typical.low}–${b.typical.high} is ${position}`);
  const gap = position === 'above' ? b.yours - b.typical.high : 0;
  if (Math.abs(b.gapPerMonth - gap) > CENT) issue(['gapPerMonth'], 'expected yours − high when above, 0 otherwise');
  if (Math.abs(b.gapPerYear - b.gapPerMonth * 12) > CENT * 12) issue(['gapPerYear'], 'expected twelve months of gapPerMonth');
});

export const OverpayingResultSchema = z.object({
  coverage: z.enum(OVERPAYING_COVERAGES),
  metro: z.string().min(1).max(100).optional(),
  lines: z.array(BenchmarkSchema).max(BENCHMARK_LINES.length),
  skipped: z.array(z.object({ line: BenchmarkLineSchema, reason: z.enum(OVERPAYING_SKIP_REASONS) })).max(BENCHMARK_LINES.length),
}).superRefine((r, ctx) => {
  const issue = issuer(ctx);
  if (hasDuplicates([...r.lines.map((l) => l.line), ...r.skipped.map((s) => s.line)])) {
    issue(['lines'], 'a line is either compared or skipped, once');
  }
  if (r.coverage === 'none' && r.lines.length > 0) issue(['lines'], 'no coverage means no lines');
  if (r.coverage === 'metro' && r.metro === undefined) issue(['metro'], 'a metro result names its metro');
});

// ----- debt payoff

const PayoffMonthSchema = z.number().int().min(0).max(PAYOFF_TIMELINE_MAX_MONTHS);

export const PayoffPlanSchema = z.object({
  method: PayoffMethodSchema,
  order: z.array(shortId).max(100),
  monthsToDebtFree: PayoffMonthSchema.nullable(),  // null = never at these payments
  totalInterest: NonNegativeMoneySchema,
  totalPaid: NonNegativeMoneySchema,
  perDebt: z.array(z.object({ id: shortId, payoffMonth: PayoffMonthSchema.nullable(), interest: NonNegativeMoneySchema })).max(100),
  timeline: z.array(z.object({ month: PayoffMonthSchema, balance: NonNegativeMoneySchema })).min(1).max(PAYOFF_TIMELINE_MAX_MONTHS + 1),
  interestSavedVsMinimum: MoneySchema,
  monthsSavedVsMinimum: z.number().int().min(0).max(PAYOFF_TIMELINE_MAX_MONTHS).nullable(),
}).superRefine((p, ctx) => {
  const issue = issuer(ctx);
  if (hasDuplicates(p.order)) issue(['order'], 'a debt appears once in the order');
  if (hasDuplicates(p.perDebt.map((d) => d.id))) issue(['perDebt'], 'a debt appears once in perDebt');
  p.timeline.forEach((point, i) => {
    if (point.month !== i) issue(['timeline', i, 'month'], 'the timeline runs month 0, 1, 2, … with no gap');
  });
});

export const PayoffComparisonSchema = z.object({
  extra: NonNegativeMoneySchema,                   // monthly
  avalanche: PayoffPlanSchema,
  snowball: PayoffPlanSchema,
  minimum: PayoffPlanSchema,
}).superRefine((c, ctx) => {
  for (const method of PAYOFF_METHODS) {
    if (c[method].method !== method) issuer(ctx)([method, 'method'], `the ${method} plan has method ${method}`);
  }
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
  anonId: AnonIdSchema,
  profile: ProfileSchema.optional(),
  wishlist: z.array(PurchaseSchema).max(SESSION_WISHLIST_MAX).optional(),
});

export const SessionStateSchema = z.object({
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

// ----- Funnel events (T8): POST /api/events, GET /api/events/funnel --------------------------

const eventId = z.uuid();
const homeIndex = z.number().int().min(1).max(EVENT_HOMES_MAX);
const eventCount = z.number().int().min(0).max(EVENT_COUNT_MAX);
const benchmarkLineCount = z.number().int().min(0).max(BENCHMARK_LINES.length);
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
  // Micro-tools (M1): enums and counts only, so a merchant, a label or an amount cannot get in.
  withProps('tool_opened', { tool: ToolIdSchema }),
  withProps('subs_started', { path: z.enum(['tickList', 'statement']) }),
  withProps('subs_revealed', { miss: MissBucketSchema }),
  withProps('subs_flagged', { count: eventCount }),
  withProps('subs_cancel_marked', { count: eventCount }),
  bare('renewals_exported'),
  z.strictObject({
    id: eventId,
    name: z.literal('overpaying_checked'),
    props: z.strictObject({ lines: benchmarkLineCount, above: benchmarkLineCount })
      .refine((p) => p.above <= p.lines, { message: 'above cannot exceed lines', path: ['above'] }),
  }),
  withProps('payoff_planned', { method: z.enum(['avalanche', 'snowball']) }),
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
