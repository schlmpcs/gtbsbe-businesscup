// Server-only: zod schemas for the /api/ai/* request bodies and for the JSON the model returns.
//
// The model fills a "wire" shape that structured outputs can enforce (every field present, null
// when the text doesn't say), which we then convert to the contract and validate with the
// canonical schemas from @lifeguessr/types. Those are the source of truth: they reject percent
// rates (6.9 instead of 0.069), negative money and impossible terms.
import {
  COST_CATEGORIES, CostCategorySchema, DEBT_KINDS, MOVE_KINDS, ProfilePatchSchema, ProfileSchema,
} from '@lifeguessr/types';
import { z } from 'zod';

// ----- limits --------------------------------------------------------------------------------

/** Longest free text we send to the model (characters). */
export const MAX_PARSE_TEXT = 1_000;
/** Request body caps in bytes, checked before JSON parsing. */
export const MAX_PARSE_BODY_BYTES = 8 * 1024;
export const MAX_EXPLAIN_BODY_BYTES = 128 * 1024; // a LoanResult may carry its schedule; we ignore it
export const MAX_FORECAST_BODY_BYTES = 32 * 1024; // a profile plus up to 8 candidate patches is a few KB

// ----- /api/ai/parse -------------------------------------------------------------------------

export const PARSE_KINDS = ['life', 'purchase', 'loan'] as const;
export type ParseKind = (typeof PARSE_KINDS)[number];

export const ParseRequestSchema = z.object({
  kind: z.enum(PARSE_KINDS),
  text: z.string().trim().min(1, 'text is empty').max(MAX_PARSE_TEXT, `text is longer than ${MAX_PARSE_TEXT} characters`),
  /**
   * Optional, for kind 'life': the user's debts (ids and kinds only, no balances), so a sentence
   * like "my card is at 24%" can be mapped to a debt id in ProfilePatch.debts.
   */
  debts: z.array(z.object({ id: z.string().min(1).max(64), kind: z.enum(DEBT_KINDS) })).max(20).optional(),
});
export type ParseRequest = z.infer<typeof ParseRequestSchema>;

const nullableMoney = z.number().nullable();

const WireLoanSchema = z.object({
  amount: nullableMoney.describe('Price or amount borrowed in US dollars, before any down payment; null if not stated.'),
  apr: z.number().nullable().describe('Annual interest rate as a decimal: 6.9% → 0.069. Never a percent number. Null if not stated.'),
  termMonths: z.number().nullable().describe('Loan term in months: 5 years → 60. Null if not stated.'),
  fees: nullableMoney.describe('Up-front fees in dollars rolled into the loan, or null.'),
  downPayment: nullableMoney.describe('Down payment in dollars, or null.'),
  extraPayment: nullableMoney.describe('Extra monthly payment in dollars, or null.'),
});

export const WIRE_SCHEMAS = {
  life: z.object({
    spending: z.object(
      Object.fromEntries(COST_CATEGORIES.map((c) => [c, nullableMoney])) as Record<
        (typeof COST_CATEGORIES)[number],
        typeof nullableMoney
      >,
    ).describe('Monthly spending per category in US dollars; null for categories the text does not mention.'),
    retirementShare: z.number().nullable()
      .describe('Share of the monthly surplus saved for retirement as a decimal (10% → 0.1), or null.'),
    debts: z.array(z.object({
      id: z.string().describe('One of the debt ids listed in the request. Never invent an id.'),
      apr: z.number().nullable().describe('New APR as a decimal (24% → 0.24), or null.'),
      extraPayment: nullableMoney.describe('Extra monthly payment in dollars, or null.'),
    })).describe('Changes to the listed debts; empty when none are listed or mentioned.'),
  }),
  purchase: z.object({
    label: z.string().describe('Short name of the purchase, e.g. "Used car" or "Gym membership".'),
    amount: nullableMoney.describe('Price per occurrence in US dollars; null if not stated.'),
    recurring: z.enum(['none', 'monthly', 'yearly']),
    payWith: z.enum(['cash', 'card', 'loan']),
    loan: WireLoanSchema.nullable().describe('Loan terms when payWith is "loan", otherwise null.'),
  }),
  loan: WireLoanSchema,
} as const;

export type WireOutput<K extends ParseKind> = z.infer<(typeof WIRE_SCHEMAS)[K]>;

// ----- /api/ai/explain -----------------------------------------------------------------------

const finite = z.number();

/** Move, as the engine returns it (packages/types: Move). */
export const MoveInputSchema = z.object({
  id: z.string().min(1).max(64),
  kind: z.enum(MOVE_KINDS),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  category: CostCategorySchema.optional(),
  effect10y: finite,
  patch: ProfilePatchSchema,
});

/** Debt payments / take-home pay; null = there is no take-home pay to measure them against. */
const debtLoad = z.number().nonnegative().nullable();

/**
 * ExplainLoanResult (packages/types): a LoanResult without the schedule, which the explanation
 * doesn't use (accepted for older clients, not forwarded), and with null for a debt load the
 * engine reports as Infinity (no take-home pay).
 */
export const LoanResultInputSchema = z.object({
  monthly: finite,
  totalInterest: finite,
  totalCost: finite,
  payoffMonth: z.number().int().min(0).max(1_200).nullable(),
  debtLoadBefore: debtLoad,
  debtLoadAfter: debtLoad,
  effect10y: finite,
  schedule: z.array(z.unknown()).max(1_200).optional(),
});

export const ExplainRequestSchema = z
  .object({
    move: MoveInputSchema.optional(),
    loanResult: LoanResultInputSchema.optional(),
  })
  .refine((b) => b.move !== undefined || b.loanResult !== undefined, {
    message: 'send a move, a loanResult, or both',
  });
export type ExplainRequest = z.infer<typeof ExplainRequestSchema>;

// ----- /api/ai/forecast ----------------------------------------------------------------------

/**
 * Largest absolute money value (dollars) a forecast request may carry. The sanity envelope's
 * tolerance grows with take-home pay: a finite but absurd pay (1e300) makes it Infinity, and then
 * every answer passes. $1 billion is far beyond any real household and far below that.
 */
export const MAX_FORECAST_MONEY = 1e9;
/** Candidate moves per request (Next Moves shows a handful; one model call answers them all). */
export const MAX_FORECAST_SCENARIOS = 8;
/** The id of the forecast of the profile as it is; a scenario cannot use it. */
export const BASE_FORECAST_ID = 'base';

/**
 * What a scenario id or a debt id may look like in a forecast request. Both are written into the
 * model's prompt inside quotes, so free text (a quote, a line break, an instruction) must not get
 * through. The real ones fit: `payCardFirst:<debt id>`, `cutCategory:<category>` and
 * `committed:<move id>` (a debt id is a UUID, 36 characters, so the longest today is
 * `committed:payCardFirst:<uuid>`, 59). 96 leaves room for a longer move kind
 * (`committed:cancelSubscriptions:<uuid>` is 66).
 */
export const FORECAST_ID_PATTERN = /^[A-Za-z0-9:_.-]{1,96}$/;
const FORECAST_ID_MESSAGE = 'an id may only contain letters, digits and : _ . - (1 to 96 characters)';

const ForecastScenarioSchema = z.object({
  id: z.string().regex(FORECAST_ID_PATTERN, FORECAST_ID_MESSAGE),
  patch: ProfilePatchSchema,
});

/** Every number in `value` with its path, to bound them all without listing the money fields by hand. */
function* numbersIn(value: unknown, path: readonly (string | number)[]): Generator<{ path: (string | number)[]; value: number }> {
  if (typeof value === 'number') yield { path: [...path], value };
  else if (Array.isArray(value)) for (const [i, v] of value.entries()) yield* numbersIn(v, [...path, i]);
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) yield* numbersIn(v, [...path, k]);
}

export const ForecastRequestSchema = z
  .object({
    profile: ProfileSchema,
    /** The area's inflation. Above −100% (the rules engine cannot deflate by it otherwise) and a decimal, never a percent. */
    rates: z.object({ inflationAnnual: z.number().gt(-1).max(1) }).optional(),
    scenarios: z.array(ForecastScenarioSchema).max(MAX_FORECAST_SCENARIOS).default([]),
  })
  .superRefine((req, ctx) => {
    req.profile.debts.forEach((d, i) => {
      if (!FORECAST_ID_PATTERN.test(d.id)) ctx.addIssue({ code: 'custom', path: ['profile', 'debts', i, 'id'], message: FORECAST_ID_MESSAGE });
    });
    // A patch on a debt the profile does not have changes nothing (applyPatch skips it): a scenario that is the base in disguise.
    const debtIds = new Set(req.profile.debts.map((d) => d.id));
    req.scenarios.forEach((s, i) => {
      s.patch.debts?.forEach((d, j) => {
        if (!debtIds.has(d.id)) {
          ctx.addIssue({ code: 'custom', path: ['scenarios', i, 'patch', 'debts', j, 'id'], message: 'is not the id of a debt in the profile' });
        }
      });
    });
    const seen = new Set<string>();
    req.scenarios.forEach((s, i) => {
      const path = ['scenarios', i, 'id'];
      if (s.id === BASE_FORECAST_ID) {
        ctx.addIssue({ code: 'custom', path, message: `"${BASE_FORECAST_ID}" is reserved for the forecast of the profile as it is` });
      } else if (seen.has(s.id)) {
        ctx.addIssue({ code: 'custom', path, message: `duplicate scenario id "${s.id}"` });
      }
      seen.add(s.id);
    });
    // Every number, not only the money fields: the rest (age, rates, shares) are bounded far below this.
    for (const n of numbersIn({ profile: req.profile, scenarios: req.scenarios }, [])) {
      if (Math.abs(n.value) > MAX_FORECAST_MONEY) {
        ctx.addIssue({ code: 'custom', path: n.path, message: `${n.value} is beyond the limit of ±${MAX_FORECAST_MONEY} dollars` });
      }
    }
  });
export type ForecastRequest = z.infer<typeof ForecastRequestSchema>;
