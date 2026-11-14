// Pure helpers of the live forecast eval (apps/web/evals/forecast.eval.ts, `pnpm eval:forecast`).
// The eval is never part of CI or `pnpm test`: it is the only thing that calls the live model
// (docs/ENGINEERING.md → AI forecast). What it computes from the answers, and what it needs from
// the environment, lives here so it is unit-tested without a model.
import type { ForecastSource, Money, Profile } from '@lifeguessr/types';

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

/** A copy of `node` with every `isEstimate: true` set to false, at any depth (records, arrays, nested objects). */
function clearEstimateFlags(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(clearEstimateFlags);
  if (node === null || typeof node !== 'object') return node;
  return Object.fromEntries(
    Object.entries(node).map(([key, value]) => [
      key,
      key === 'isEstimate' && typeof value === 'boolean' ? false : clearEstimateFlags(value),
    ]),
  );
}

/**
 * The same person with every input given as exact: `isEstimate: false` on every `{ value,
 * isEstimate }` in the profile (age, pay, each spending line, balances, each debt's minimum payment,
 * and any field added later). The numbers are unchanged. A new object all the way down: the profile
 * given (a frozen fixture, say) is not touched.
 */
export function measuredProfile(p: Profile): Profile {
  return clearEstimateFlags(p) as Profile;
}
