// "Together": a couple's shared plan behind a link, no login (/together, /together/<id>).
//
// A plan holds only the numbers the household math needs from each partner: take-home pay, the
// spending categories, cash, retirement balance and share, and debts (kind, balance, APR, minimum
// payment). No names (an optional nickname the person types is the only label), no ZIP, no age,
// no statements. The id is the capability: 22 random base64url characters (128 bits), so a link
// cannot be guessed; whoever holds it can read the plan and fill in partner 2. Plans expire after
// TOGETHER_TTL_DAYS.
//
// Units as everywhere: Money is unrounded US dollars (monthly or a balance, per field), rates are
// decimals per year.
import { z } from 'zod';
import { GoalSchema } from './goal';
import { CostCategorySchema, DebtKindSchema, AprSchema, ShareSchema, estimate } from './schemas';

/** Days a shared plan lives after it is created. */
export const TOGETHER_TTL_DAYS = 30;
/** Most debts per partner in a shared plan. */
export const TOGETHER_DEBTS_MAX = 20;
/** Longest nickname a partner can type. */
export const TOGETHER_NICKNAME_MAX = 24;
/** Upper bound for any amount in a plan (monthly or balance), so a typo cannot overflow the math. */
export const TOGETHER_MONEY_MAX = 10_000_000;
/** Request body cap for the together routes: a partner is well under 4 KB even with every debt. */
export const TOGETHER_MAX_BODY_BYTES = 16 * 1024;

export const TOGETHER_ERROR_CODES = ['bad_request', 'too_large', 'rate_limited', 'not_found', 'unavailable'] as const;
export type TogetherErrorCode = (typeof TOGETHER_ERROR_CODES)[number];

/** A plan id: 16 random bytes as base64url. */
export const TogetherIdSchema = z.string().regex(/^[A-Za-z0-9_-]{22}$/, 'expected a plan id');

const Amount = z.number().finite().min(0).max(TOGETHER_MONEY_MAX);
const Balance = z.number().finite().min(-TOGETHER_MONEY_MAX).max(TOGETHER_MONEY_MAX);

export const TogetherDebtSchema = z.strictObject({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/),
  kind: DebtKindSchema,
  balance: Amount,
  apr: AprSchema,
  minPayment: estimate(Amount), // monthly
});

/** A nickname: letters, digits, spaces and . ' - only (no markup, no emails, no links). */
export const TogetherNicknameSchema = z
  .string()
  .trim()
  .max(TOGETHER_NICKNAME_MAX)
  .regex(/^[\p{L}\p{N} .'-]*$/u, 'letters, digits, spaces and . \' - only');

/** One partner's numbers: what the household math needs, nothing more. */
export const TogetherPartnerSchema = z.strictObject({
  nickname: TogetherNicknameSchema.optional(),
  takeHomePay: estimate(Amount), // monthly
  spending: z.record(CostCategorySchema, estimate(Amount)), // monthly, every category
  cash: estimate(Balance), // balance
  retirement: estimate(Amount), // balance
  retirementShare: estimate(ShareSchema),
  debts: z.array(TogetherDebtSchema).max(TOGETHER_DEBTS_MAX),
});
export type TogetherPartner = z.infer<typeof TogetherPartnerSchema>;
export type TogetherDebt = z.infer<typeof TogetherDebtSchema>;

export const TogetherPlanSchema = z.object({
  id: TogetherIdSchema,
  partner1: TogetherPartnerSchema,
  partner2: TogetherPartnerSchema.nullable(),
  goal: GoalSchema.nullable(),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
});
export type TogetherPlan = z.infer<typeof TogetherPlanSchema>;

/** POST /api/together: partner 1 creates the plan (optionally with the shared goal). */
export const TogetherCreateRequestSchema = z.strictObject({
  partner: TogetherPartnerSchema,
  goal: GoalSchema.nullable().optional(),
});
/** PUT /api/together/<id>/partner: partner 2 adds (or updates) their numbers, optionally the goal. */
export const TogetherPartnerRequestSchema = TogetherCreateRequestSchema;

/** The reply of every together route on success. */
export const TogetherResponseSchema = z.object({ ok: z.literal(true), plan: TogetherPlanSchema });

export const TogetherErrorResponseSchema = z.object({
  ok: z.literal(false),
  error: z.object({ code: z.enum(TOGETHER_ERROR_CODES), retryAfterSeconds: z.number().optional() }).loose(),
});
