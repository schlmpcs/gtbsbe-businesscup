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
  AREA_TIERS, CATEGORIZED_BY, COST_CATEGORIES, DEBT_KINDS, KID_AGES, MAX_STATEMENT_ITEMS, PRO_ERROR_CODES, PRO_PLANS,
  PRO_SOURCES, SESSION_ERROR_CODES, SESSION_WISHLIST_MAX, STATEMENT_CLASSES,
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

export const CategoryTotalsSchema = z.object({
  month: MonthSchema,
  totals: z.record(CostCategorySchema, MoneySchema),
  oneOffs: z.array(z.object({ label: z.string().min(1), amount: MoneySchema })),
  detectedPay: NonNegativeMoneySchema.optional(),  // monthly
});

export const StatementClassSchema = z.enum(STATEMENT_CLASSES);

/** Days in a 'YYYY-MM' month (UTC calendar). */
const daysInMonth = (month: string) => {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

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
    plan: ProPlanSchema.optional(),                // stripe_test only
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
