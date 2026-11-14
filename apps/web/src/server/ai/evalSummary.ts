// Pure helpers of the live forecast eval (apps/web/evals/forecast.eval.ts, `pnpm eval:forecast`).
// The eval is never part of CI or `pnpm test`: it is the only thing that calls the live model
// (docs/ENGINEERING.md → AI forecast). What it computes from the answers, and what it needs from
// the environment, lives here so it is unit-tested without a model.
import { COST_CATEGORIES, type Estimate, type ForecastSource, type Money, type Profile } from '@lifeguessr/types';

/** One model call's 10-year answer for the base profile, nominal dollars, and where it came from. */
export type EvalRun = { in10yMid: Money; in10yLow: Money; in10yHigh: Money; source: ForecastSource };

export type EvalSummary = {
  /** Calls made, whatever they returned. */
  runs: number;
  /** Calls that returned a model answer (`source: 'ai'`); the rest fell back to the rules and count in nothing below. */
  aiRuns: number;
  meanMid: Money;
  /** Population stdev of the AI runs' in10y mid over |meanMid|: how much the model disagrees with itself. */
  spread: number;
  /** (meanMid − rulesMid) / |rulesMid|: how far the model's mean sits from the rules engine's answer. */
  gapToRules: number;
  /** Mean of in10y high − low over the AI runs. */
  meanBandWidth: Money;
};

const mean = (values: readonly number[]): number => values.reduce((sum, v) => sum + v, 0) / values.length;

/**
 * Summarizes the runs of one profile against the rules engine's in10y mid for the same request.
 * Only `source: 'ai'` runs are counted in the statistics. With no AI run there is nothing to
 * average: every statistic is NaN, never a zero that would read as "no spread, no gap". A zero
 * mean mid or rules mid makes `spread` or `gapToRules` Infinity (or NaN), by the formulas above.
 */
export function summarizeRuns(runs: readonly EvalRun[], rulesMid: Money): EvalSummary {
  const answered = runs.filter((r) => r.source === 'ai');
  if (answered.length === 0) {
    return { runs: runs.length, aiRuns: 0, meanMid: NaN, spread: NaN, gapToRules: NaN, meanBandWidth: NaN };
  }
  const mids = answered.map((r) => r.in10yMid);
  const meanMid = mean(mids);
  const stdev = Math.sqrt(mean(mids.map((m) => (m - meanMid) ** 2)));
  return {
    runs: runs.length,
    aiRuns: answered.length,
    meanMid,
    spread: stdev / Math.abs(meanMid),
    gapToRules: (meanMid - rulesMid) / Math.abs(rulesMid),
    meanBandWidth: mean(answered.map((r) => r.in10yHigh - r.in10yLow)),
  };
}

type Env = Readonly<Record<string, string | undefined>>;

/**
 * Why the live eval cannot run, or null when it can. Reads the key the way the app's client does
 * (`getLlmClient`: trimmed, blank = unset). The reason never repeats an environment value.
 */
export function evalSkipReason(env: Env): string | null {
  if (env.ANTHROPIC_API_KEY?.trim()) return null;
  return (
    'ANTHROPIC_API_KEY is not set, so the live forecast eval is skipped (no model call was made). ' +
    'Export it or put it in .env or .env.local at the repo root, then run `pnpm eval:forecast` again.'
  );
}

export const DEFAULT_EVAL_RUNS = 5;

/** Model calls per profile: `EVAL_RUNS`, default 5. Anything else than a whole number of at least 1 is an error, not a quiet default. */
export function evalRunCount(env: Env): number {
  const raw = env.EVAL_RUNS?.trim();
  if (!raw) return DEFAULT_EVAL_RUNS;
  const runs = /^[1-9]\d*$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isSafeInteger(runs)) throw new RangeError(`EVAL_RUNS must be a whole number of at least 1, got "${raw}"`);
  return runs;
}

const exact = <T>(e: Estimate<T>): Estimate<T> => ({ ...e, isEstimate: false });

/**
 * The same person with every input given as exact (`isEstimate: false` on each field and each
 * debt's minimum payment). The numbers are unchanged. A new object: the profile given (a frozen
 * fixture, say) is not touched.
 */
export function measuredProfile(p: Profile): Profile {
  return {
    ...p,
    age: exact(p.age),
    takeHomePay: exact(p.takeHomePay),
    spending: Object.fromEntries(COST_CATEGORIES.map((c) => [c, exact(p.spending[c])])) as Profile['spending'],
    cash: exact(p.cash),
    retirement: exact(p.retirement),
    retirementShare: exact(p.retirementShare),
    debts: p.debts.map((d) => ({ ...d, minPayment: exact(d.minPayment) })),
    doneMoveIds: [...p.doneMoveIds],
  };
}
