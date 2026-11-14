// What if? Two choices, two futures. A Scenario is a list of changes applied to a Profile; the
// engine (packages/engine/whatIf.ts) turns each into a rules forecast and compares the two.
// Units follow ./index.ts: Money = unrounded US dollars (monthly or balance, stated per field),
// rates are decimals per year. `inMonths` = 0-based month the change starts (0 = this month).
import { z } from 'zod';
import type { CostCategory, Debt, ForecastPoint, KidAge, LoanInput, Money, Purchase } from './index';
import type { GoalStatus } from './goal';
import { GoalSchema } from './goal';
import {
  CostCategorySchema, DebtKindSchema, ForecastPointSchema, KidAgeSchema, LoanInputSchema, PurchaseSchema, ZipSchema,
} from './schemas';

/** Latest start month a what-if change may have (the comparison runs 10 years). */
export const WHAT_IF_MAX_START_MONTH = 120;

export type ScenarioChange =
  /** Buy something: cash or card (paid off from the surplus, as in Can I Afford It?) or a loan. */
  | { kind: 'purchase'; purchase: Purchase; category?: CostCategory; inMonths?: number }
  /** A loan that pays for something (amount = price before the down payment). */
  | { kind: 'loan'; loan: LoanInput; label?: string; category?: CostCategory; inMonths?: number }
  /** Move to one of our ZIPs: housing, childcare, groceries and car costs are re-costed from its data. */
  | { kind: 'move'; zip: string }
  /** A child of this age joins the household in `inMonths` months, then grows through the age bands. */
  | { kind: 'kid'; age: KidAge; inMonths?: number }
  /** Monthly take-home pay changes by this much (negative = a cut). `grossYearly` = the raise as stated, if any. */
  | { kind: 'income'; monthlyDelta: Money; grossYearly?: Money }
  /** New monthly rent + utilities. */
  | { kind: 'rent'; monthly: Money }
  /** Pay down a debt of this kind from cash today; no amount = as much as cash and the balance allow. */
  | { kind: 'payDebt'; debtKind: Debt['kind']; amount?: Money };

export type ScenarioChangeKind = ScenarioChange['kind'];
export type Scenario = { label: string; changes: ScenarioChange[] };

/** What a 10-year difference can be put down to: a spending category, or pay. */
export type WhatIfTerm = CostCategory | 'income';

export type FutureSide = {
  /** Net worth, today's dollars, month 0..years×12 (rules forecast). */
  points: ForecastPoint[];
  /** The point at the horizon. */
  end: ForecastPoint;
  /** Points at month 0, 12, 24, … (for the year scrubber). */
  yearly: ForecastPoint[];
  /** Verdict for the user's goal, if one is set (rules forecast, today's dollars). */
  goal: GoalStatus | null;
  /** Monthly change vs the plan as it is, by term, in the first month every change is in place (today's dollars). */
  monthly: { term: WhatIfTerm; delta: Money }[];
  /** Can I Afford It? verdict for each one-time or recurring purchase in the scenario (by change index). */
  afford: { index: number; verdict: 'fits' | 'wait' | 'no'; waitMonths?: number }[];
};

export type FutureComparison = {
  years: number;
  todaysDollars: true;
  source: 'rules';
  /** The plan as it is, for reference. */
  base: { end: ForecastPoint; yearly: ForecastPoint[] };
  A: FutureSide;
  B: FutureSide;
  /** B.end.mid − A.end.mid. */
  diff: Money;
  /**
   * The term whose changes moved the two futures apart the most in the winner's favor: its own
   * effect on each side's end value (mid, vs the plan as it is) and the gap B − A. Null on a tie.
   */
  decidedBy: { term: WhatIfTerm; effectA: Money; effectB: Money; gap: Money } | null;
};

// ----- zod -----------------------------------------------------------------------------------

const startMonth = z.number().int().min(0).max(WHAT_IF_MAX_START_MONTH).optional();

export const ScenarioChangeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('purchase'), purchase: PurchaseSchema, category: CostCategorySchema.optional(), inMonths: startMonth }),
  z.object({
    kind: z.literal('loan'), loan: LoanInputSchema, label: z.string().min(1).max(120).optional(),
    category: CostCategorySchema.optional(), inMonths: startMonth,
  }),
  z.object({ kind: z.literal('move'), zip: ZipSchema }),
  z.object({ kind: z.literal('kid'), age: KidAgeSchema, inMonths: startMonth }),
  z.object({
    kind: z.literal('income'), monthlyDelta: z.number().min(-1e6).max(1e6), grossYearly: z.number().min(-1e7).max(1e7).optional(),
  }),
  z.object({ kind: z.literal('rent'), monthly: z.number().min(0).max(1e6) }),
  z.object({ kind: z.literal('payDebt'), debtKind: DebtKindSchema, amount: z.number().positive().max(1e9).optional() }),
]);

/** A scenario holds at most this many changes (a what-if is a handful of decisions, not a plan). */
export const SCENARIO_MAX_CHANGES = 8;

export const ScenarioSchema = z.object({
  label: z.string().min(1).max(80),
  changes: z.array(ScenarioChangeSchema).max(SCENARIO_MAX_CHANGES),
});

const WhatIfTermSchema = z.union([CostCategorySchema, z.literal('income')]);

const GoalStatusSchema = z.object({
  goal: GoalSchema,
  projected: ForecastPointSchema,
  gap: z.number(),
  progress: z.number(),
  verdict: z.enum(['onTrack', 'withinRange', 'behind']),
});

const FutureSideSchema = z.object({
  points: z.array(ForecastPointSchema).min(2),
  end: ForecastPointSchema,
  yearly: z.array(ForecastPointSchema).min(2),
  goal: GoalStatusSchema.nullable(),
  monthly: z.array(z.object({ term: WhatIfTermSchema, delta: z.number() })),
  afford: z.array(z.object({
    index: z.number().int().min(0), verdict: z.enum(['fits', 'wait', 'no']), waitMonths: z.number().int().positive().optional(),
  })),
});

export const FutureComparisonSchema = z.object({
  years: z.number().positive(),
  todaysDollars: z.literal(true),
  source: z.literal('rules'),
  base: z.object({ end: ForecastPointSchema, yearly: z.array(ForecastPointSchema) }),
  A: FutureSideSchema,
  B: FutureSideSchema,
  diff: z.number(),
  decidedBy: z.object({ term: WhatIfTermSchema, effectA: z.number(), effectB: z.number(), gap: z.number() }).nullable(),
});
