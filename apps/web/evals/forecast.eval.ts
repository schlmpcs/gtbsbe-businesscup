// Live eval of the AI 10-year forecast (Y19). NOT part of CI or `pnpm test`: it calls the real
// model, costs API calls and takes minutes. Run it by hand: `pnpm eval:forecast` (config:
// apps/web/vitest.eval.config.ts; docs/ENGINEERING.md → AI forecast).
//
// For the demo profile as it is (some inputs estimated) and the same profile with every input
// exact, it calls `forecastWithModel` EVAL_RUNS times (default 5) with the request the app sends
// (Next Moves' candidates as scenarios, the area's inflation), bypassing the route's cache, and
// prints per profile the model, the prompt version, the runs, the EvalSummary and the rules
// engine's answer for comparison; then whether the model's band is narrower for the exact profile.
// It prints no prompt and no environment value. It skips, printing why, when ANTHROPIC_API_KEY is unset.
import { hasEstimates, moveCandidates, rulesBundle } from '@lifeguessr/engine';
import type { Profile } from '@lifeguessr/types';
import { describe, expect, it } from 'vitest';
import { buildRequest } from '@/features/forecast/model/forecastAnswer';
import { cloneProfileDemo } from '@/fixtures';
import { formatMoney } from '@/lib/format';
import { areaRates } from '@/lib/model/profile';
import { forecastModel, getLlmClient } from '@/server/ai/client';
import {
  evalRunCount, evalSkipReason, measuredProfile, summarizeRuns, type EvalRun, type EvalSummary,
} from '@/server/ai/evalSummary';
import { FORECAST_DEADLINE_MS, PROMPT_VERSION, forecastWithModel } from '@/server/ai/forecast';
import { ForecastRequestSchema, type ForecastRequest } from '@/server/ai/schemas';

const skipReason = evalSkipReason(process.env);
if (skipReason) console.warn(`[forecast eval] skipped: ${skipReason}`);
// Read only when the eval runs, so a typo in EVAL_RUNS does not fail a skipped run.
const runs = skipReason ? 0 : evalRunCount(process.env);
/** Every call is bounded by the forecast deadline; two profiles, `runs` calls each, one at a time. */
const TEST_TIMEOUT_MS = 2 * runs * (FORECAST_DEADLINE_MS + 5_000);

/** The request the app sends for this profile: Next Moves' candidates as scenarios, the area's inflation, as the route parses it. */
function requestFor(profile: Profile): ForecastRequest {
  const candidates = moveCandidates(profile, { rates: areaRates(profile), subscriptionsDetected: false });
  const { scenarios, rates } = buildRequest(profile, candidates, undefined);
  return ForecastRequestSchema.parse({ profile, rates, scenarios });
}

type Measured = { label: string; summary: EvalSummary; rulesMid: number; rulesBand: number };

async function measure(label: string, profile: Profile): Promise<Measured> {
  const client = getLlmClient();
  if (!client) throw new Error('no LLM client although ANTHROPIC_API_KEY is set'); // evalSkipReason said otherwise
  const req = requestFor(profile);
  const { in10y: rules } = rulesBundle(req.profile, req.scenarios, req.rates).base;
  const results: EvalRun[] = [];
  for (let i = 0; i < runs; i++) {
    const { source, base } = await forecastWithModel(req, client); // the route's cache is not involved
    results.push({ in10yMid: base.in10y.mid, in10yLow: base.in10y.low, in10yHigh: base.in10y.high, source });
  }
  return {
    label,
    summary: summarizeRuns(results, rules.mid),
    rulesMid: rules.mid,
    rulesBand: rules.high - rules.low,
  };
}

const money = (v: number): string => formatMoney(v);
const percent = (v: number, signed = false): string =>
  Number.isFinite(v) ? `${signed && v > 0 ? '+' : ''}${(v * 100).toFixed(1)}%` : 'n/a';

function print({ label, summary: s, rulesMid, rulesBand }: Measured): void {
  console.log([
    `\n== ${label}`,
    `model ${forecastModel()} · prompt v${PROMPT_VERSION} · ${s.runs} runs`,
    `answered by the model ${s.aiRuns}/${s.runs}${s.aiRuns < s.runs ? ` (${s.runs - s.aiRuns} fell back to the rules; see the warnings above)` : ''}`,
    `rules 10-year mid          ${money(rulesMid)} (rules band ${money(rulesBand)} wide)`,
    `mean 10-year mid           ${money(s.meanMid)}`,
    `spread (stdev / |mean|)    ${percent(s.spread)}`,
    `gap to rules               ${percent(s.gapToRules, true)}`,
    `mean band width            ${money(s.meanBandWidth)}`,
  ].join('\n'));
}

describe.skipIf(skipReason !== null)('forecast eval (live model)', () => {
  it('measures the AI forecast of the demo profile, estimated and measured', { timeout: TEST_TIMEOUT_MS }, async () => {
    const estimatedProfile = cloneProfileDemo();
    const exactProfile = measuredProfile(estimatedProfile);
    // The comparison below means nothing if the "measured" profile still carries an estimate.
    expect(hasEstimates(estimatedProfile)).toBe(true);
    expect(JSON.stringify(exactProfile)).not.toContain('"isEstimate":true');

    const estimated = await measure('demo profile, estimated inputs as in the fixture', estimatedProfile);
    const measured = await measure('demo profile, every input measured', exactProfile);
    print(estimated);
    print(measured);

    const [e, m] = [estimated.summary, measured.summary];
    console.log(
      e.aiRuns > 0 && m.aiRuns > 0
        ? `\nAI band narrower for the measured profile than for the estimated one: ${m.meanBandWidth < e.meanBandWidth ? 'yes' : 'NO'} ` +
            `(${money(m.meanBandWidth)} vs ${money(e.meanBandWidth)})`
        : '\nAI band comparison: not possible, one of the profiles got no model answer',
    );

    // A run where the model never answered (bad key, outage, every answer rejected) is not an eval result.
    expect(e.aiRuns, 'no model answer for the estimated profile').toBeGreaterThan(0);
    expect(m.aiRuns, 'no model answer for the measured profile').toBeGreaterThan(0);
  });
});
