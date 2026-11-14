import { hasEstimates } from '@lifeguessr/engine';
import { describe, expect, it } from 'vitest';
import { cloneProfileDemo, profileDemo } from '@/fixtures';
import {
  evalRunCount, evalSkipReason, measuredProfile, summarizeRuns, type EvalRun,
} from './evalSummary';

const ai = (mid: number, low = mid - 10, high = mid + 10): EvalRun => ({
  in10yMid: mid, in10yLow: low, in10yHigh: high, source: 'ai',
});

describe('summarizeRuns', () => {
  it('summarizes three AI runs: mean, relative spread, gap to the rules, mean band width', () => {
    const runs = [ai(100, 95, 105), ai(110, 100, 120), ai(90, 85, 95)];
    const summary = summarizeRuns(runs, 100);
    expect(summary.runs).toBe(3);
    expect(summary.aiRuns).toBe(3);
    expect(summary.meanMid).toBeCloseTo(100, 10);
    // Population stdev of 100, 110, 90 is sqrt(200 / 3) ≈ 8.165, over |mean| 100.
    expect(summary.spread).toBeCloseTo(0.0816, 3);
    expect(summary.spread).toBeCloseTo(Math.sqrt(200 / 3) / 100, 10);
    expect(summary.gapToRules).toBeCloseTo(0, 10);
    // Widths 10, 20 and 10.
    expect(summary.meanBandWidth).toBeCloseTo(40 / 3, 10);
  });

  it('counts only source "ai" runs: a rules fallback is in `runs` but not in any statistic', () => {
    const rulesRun: EvalRun = { in10yMid: 5_000, in10yLow: 0, in10yHigh: 90_000, source: 'rules' };
    const summary = summarizeRuns([ai(100), rulesRun, ai(110), ai(90)], 100);
    expect(summary.runs).toBe(4);
    expect(summary.aiRuns).toBe(3);
    expect(summary.meanMid).toBeCloseTo(100, 10);
    expect(summary.meanBandWidth).toBeCloseTo(20, 10);
  });

  it('gives NaN, not zero, when there is no AI run (all fell back, or no runs at all)', () => {
    const rulesOnly: EvalRun = { in10yMid: 100, in10yLow: 90, in10yHigh: 110, source: 'rules' };
    for (const runs of [[rulesOnly, rulesOnly], []]) {
      const summary = summarizeRuns(runs, 100);
      expect(summary.runs).toBe(runs.length);
      expect(summary.aiRuns).toBe(0);
      expect(summary.spread).toBeNaN();
      expect(summary.gapToRules).toBeNaN();
      expect(summary.meanMid).toBeNaN();
      expect(summary.meanBandWidth).toBeNaN();
    }
  });

  it('reads the gap relative to the size of the rules mid, so a negative net worth keeps its sign', () => {
    expect(summarizeRuns([ai(125)], 100).gapToRules).toBeCloseTo(0.25, 10); // 25% above the rules
    expect(summarizeRuns([ai(75)], 100).gapToRules).toBeCloseTo(-0.25, 10); // 25% below
    // Rules say -100, the model says -50: higher than the rules by half of |-100|.
    expect(summarizeRuns([ai(-50)], -100).gapToRules).toBeCloseTo(0.5, 10);
  });

  it('measures the spread against |mean|, so negative mids give the same spread as positive ones', () => {
    const summary = summarizeRuns([ai(-100), ai(-110), ai(-90)], -100);
    expect(summary.meanMid).toBeCloseTo(-100, 10);
    expect(summary.spread).toBeCloseTo(Math.sqrt(200 / 3) / 100, 10);
  });

  it('has no spread to speak of for a single run or identical runs', () => {
    expect(summarizeRuns([ai(100)], 100).spread).toBe(0);
    expect(summarizeRuns([ai(100), ai(100)], 100).spread).toBe(0);
  });
});

describe('evalSkipReason', () => {
  it('says why the eval is skipped when ANTHROPIC_API_KEY is unset or blank', () => {
    expect(evalSkipReason({})).toMatch(/ANTHROPIC_API_KEY/);
    expect(evalSkipReason({ ANTHROPIC_API_KEY: '' })).toMatch(/ANTHROPIC_API_KEY/);
    expect(evalSkipReason({ ANTHROPIC_API_KEY: '   ' })).toMatch(/ANTHROPIC_API_KEY/);
  });

  it('does not skip when a key is set', () => {
    expect(evalSkipReason({ ANTHROPIC_API_KEY: 'sk-ant-test' })).toBeNull();
    expect(evalSkipReason({ ANTHROPIC_API_KEY: ' sk-ant-test ' })).toBeNull();
  });
});

describe('evalRunCount', () => {
  it('defaults to 5 and reads EVAL_RUNS', () => {
    expect(evalRunCount({})).toBe(5);
    expect(evalRunCount({ EVAL_RUNS: '' })).toBe(5);
    expect(evalRunCount({ EVAL_RUNS: '12' })).toBe(12);
    expect(evalRunCount({ EVAL_RUNS: ' 3 ' })).toBe(3);
  });

  it('rejects anything but a whole number of at least 1, instead of silently running something else', () => {
    for (const bad of ['0', '-2', '2.5', 'abc', '5 runs', '1e3', 'NaN']) {
      expect(() => evalRunCount({ EVAL_RUNS: bad }), bad).toThrow(/EVAL_RUNS/);
    }
  });
});

describe('measuredProfile', () => {
  it('is the profile with every estimate flag cleared and every number unchanged', () => {
    const measured = measuredProfile(profileDemo);
    expect(hasEstimates(profileDemo)).toBe(true);
    expect(hasEstimates(measured)).toBe(false);
    // Nothing is flagged anywhere, not even the fields `hasEstimates` ignores (spending.debtPayments).
    expect(JSON.stringify(measured)).not.toContain('"isEstimate":true');
    // Only the flags differ.
    expect(JSON.parse(JSON.stringify(measured).replaceAll('"isEstimate":false', '"isEstimate":true'))).toEqual(
      JSON.parse(JSON.stringify(profileDemo).replaceAll('"isEstimate":false', '"isEstimate":true')),
    );
  });

  it('clears every estimate flag wherever it sits, so a field added to Profile later is not missed', () => {
    const flagged = (node: unknown): boolean =>
      Array.isArray(node)
        ? node.some(flagged)
        : node !== null && typeof node === 'object'
          ? Object.entries(node).some(([k, v]) => (k === 'isEstimate' && v === true) || flagged(v))
          : false;
    // A made-up Estimate field at the top, in a record, and in an array of objects.
    const future = {
      ...cloneProfileDemo(),
      mortgageRate: { value: 0.06, isEstimate: true },
      goals: [{ name: 'house', target: { value: 50_000, isEstimate: true } }],
    };
    expect(flagged(future)).toBe(true);
    const measured = measuredProfile(future);
    expect(flagged(measured)).toBe(false);
    expect(measured).toMatchObject({ mortgageRate: { value: 0.06 }, goals: [{ name: 'house', target: { value: 50_000 } }] });
    expect(flagged(measuredProfile(profileDemo))).toBe(false);
  });

  it('returns new objects all the way down (nothing is shared with the profile given)', () => {
    const measured = measuredProfile(profileDemo);
    expect(measured).not.toBe(profileDemo);
    expect(measured.spending).not.toBe(profileDemo.spending);
    expect(measured.spending.car).not.toBe(profileDemo.spending.car);
    expect(measured.debts).not.toBe(profileDemo.debts);
    expect(measured.debts[0]).not.toBe(profileDemo.debts[0]);
    expect(measured.debts[0]!.minPayment).not.toBe(profileDemo.debts[0]!.minPayment);
  });

  it('does not touch the profile it is given (the fixture is frozen)', () => {
    const before = JSON.stringify(profileDemo);
    measuredProfile(profileDemo);
    expect(JSON.stringify(profileDemo)).toBe(before);
    expect(profileDemo.takeHomePay.isEstimate).toBe(false);
    expect(profileDemo.spending.car.isEstimate).toBe(true);
  });
});
