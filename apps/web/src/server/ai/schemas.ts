// Server-only: zod schemas for the /api/ai/* request bodies and for the JSON the model returns.
//
// The model fills a "wire" shape that structured outputs can enforce (every field present, null
// when the text doesn't say), which we then convert to the contract and validate with the
// canonical schemas from @lifeguessr/types. Those are the source of truth: they reject percent
// rates (6.9 instead of 0.069), negative money and impossible terms.
import {
  COST_CATEGORIES, CostCategorySchema, DEBT_KINDS, MOVE_KINDS, ProfilePatchSchema,
} from '@lifeguessr/types';
import { z } from 'zod';

// ----- limits --------------------------------------------------------------------------------

/** Longest free text we send to the model (characters). */
export const MAX_PARSE_TEXT = 1_000;
/** Request body caps in bytes, checked before JSON parsing. */
export const MAX_PARSE_BODY_BYTES = 8 * 1024;
export const MAX_EXPLAIN_BODY_BYTES = 128 * 1024; // a LoanResult may carry its schedule; we ignore it

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

