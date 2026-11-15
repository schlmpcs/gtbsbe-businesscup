// The dashed "AI estimate" line on the net worth chart (decision #1 in #160). It asks the existing
// POST /api/ai/forecast for the profile the plan is built on (accounts folded in, the scenario's
// inflation), converts the 10-year forecast to the plan's years (each plan year's last month, counted
// from asOf as plan() counts it) and display unit (deflateForecast for today's dollars), and shows it
// only when
//   1. today's value matches the plan's to the cent (the accounts' net worth, netWorthSummary), and
//   2. every point lies inside the Monte Carlo p5–p95 band of the scenario (monteCarlo with a fixed
//      seed and 300 paths, run once per plan version in the Web Worker).
// Otherwise the line is hidden: 'rejected' with the reason. A rules answer (no model, an error, a
// timeout) is not an AI estimate: 'off'. The line never feeds a KPI, a move or the Chance of success.
// `preview` lets the UI render each state while designing.
import { deflateForecast, netWorthSummary, simulate } from '@lifeguessr/engine';
import type { ForecastBundle, MonteCarloResult, MonteCarloSettings, Money, PlanResult, Scenario } from '@lifeguessr/types';
import { useEffect, useMemo, useState } from 'react';
import { plan as copy } from '@/copy';
import { monteCarloDemo } from '@/fixtures';
import { fetchForecastBundle } from '@/lib/api/aiForecast';
import { canonicalJson } from '@/lib/canonicalJson';
import { getAnonId } from '@/state/anonId';
import { startMonteCarloJob } from './monteCarloJob';
import { planFor, planProfileOf, usePlanInputs, type PlanInputs } from './planInputs';
import { DEFAULT_CHANCE_SETTINGS, usePlanStore } from './planStore';
import type { AiLineRejectReason, AiLineStatus, AiLineVM } from './types';

export type AiLinePreview = { status: AiLineStatus; reason?: AiLineRejectReason };

/** The band the AI line is checked against: a fixed seed and 300 paths (the issue's numbers). */
export const AI_LINE_SEED = 42;
export const AI_LINE_PATHS = 300;

/** Monte Carlo settings of the band: the scenario's inflation as the mean, the default spreads. */
export const aiBandSettings = (scenario: Scenario): MonteCarloSettings => ({
  ...DEFAULT_CHANCE_SETTINGS,
  paths: AI_LINE_PATHS,
  seed: AI_LINE_SEED,
  inflation: { mean: scenario.assumptions.inflation, sd: DEFAULT_CHANCE_SETTINGS.inflation.sd },
});

/** Today's net worth the plan starts from: the included accounts, or the profile's own balances without accounts. */
export function planTodayNetWorth(inputs: PlanInputs): Money {
  return inputs.accounts.length > 0 ? netWorthSummary(inputs.accounts).netWorth : simulate(inputs.profile, 0).path[0]!.netWorth;
}

const cents = (v: Money): number => Math.round(v * 100);

/**
 * The forecast at the end of each plan year it reaches (month m = the year's last month counted from
 * asOf: 12 × (index + 1) − (asOf month − 1)), in the plan's display unit.
 */
export function aiLinePoints(bundle: ForecastBundle, plan: PlanResult, scenario: Scenario, asOfMonth: number): { year: number; netWorth: Money }[] {
  const f = scenario.assumptions.display === 'today' ? deflateForecast(bundle.base, scenario.assumptions.inflation) : bundle.base;
  return plan.years.flatMap((y, i) => {
    const point = f.points[12 * (i + 1) - (asOfMonth - 1)];
    return point ? [{ year: y.year, netWorth: point.mid }] : [];
  });
}

/** Why the line may not be shown, or null: today's value first, then the band. */
export function aiLineRejection(
  bundle: ForecastBundle, points: { year: number; netWorth: Money }[], band: MonteCarloResult, todayNetWorth: Money,
): AiLineRejectReason | null {
  const today = bundle.base.points[0];
  if (!today || cents(today.mid) !== cents(todayNetWorth)) return 'todayMismatch';
  const byYear = new Map(band.bands.map((b) => [b.year, b]));
  const inside = points.length > 0 && points.every((p) => {
    const b = byYear.get(p.year);
    // p5/p95 since MP5; without them the narrower p10–p90 band is used.
    return b !== undefined && p.netWorth >= (b.p5 ?? b.p10) && p.netWorth <= (b.p95 ?? b.p90);
  });
  return inside ? null : 'outsideBand';
}

type Answer = { key: string; bundle: ForecastBundle | null };
type Band = { inputs: PlanInputs; scenario: Scenario; result: MonteCarloResult | null };

export function useAiLine(preview?: AiLinePreview): AiLineVM {
  const inputs = usePlanInputs();
  const scenario = usePlanStore((s) => s.scenarios.find((x) => x.id === s.activeId));

  // What is asked: the profile plan() builds on and the scenario's inflation. Keyed by its content, so
  // an edit that changes neither (an event, the display unit) asks nothing new.
  const request = useMemo(() => {
    if (preview || !scenario) return null;
    const body = { profile: planProfileOf(inputs), rates: { inflationAnnual: scenario.assumptions.inflation } };
    return { key: canonicalJson(body), ...body };
  }, [preview, inputs, scenario]);
  const requestKey = request?.key ?? null;

  const [answer, setAnswer] = useState<Answer | null>(null);
  useEffect(() => {
    if (!request) return;
    const controller = new AbortController();
    fetchForecastBundle(request.profile, [], { rates: request.rates, anonId: getAnonId(), signal: controller.signal }).then(
      (bundle) => setAnswer({ key: request.key, bundle }),
      () => {
        if (!controller.signal.aborted) setAnswer({ key: request.key, bundle: null });
      },
    );
    return () => controller.abort();
  }, [requestKey]); // eslint-disable-line react-hooks/exhaustive-deps -- a new `request` with the same key asks the same thing


  const current = answer && answer.key === requestKey ? answer : null;
  const isAi = current?.bundle?.source === 'ai';

  // The band, only once there is an AI answer to check.
  const [band, setBand] = useState<Band | null>(null);
  useEffect(() => {
    if (!isAi || !scenario) return;
    return startMonteCarloJob({ kind: 'monteCarlo', inputs, scenario, settings: aiBandSettings(scenario) }, (res) =>
      setBand({ inputs, scenario, result: res.kind === 'monteCarlo' ? res.result : null }));
  }, [isAi, inputs, scenario]);

  return useMemo((): AiLineVM => {
    const label = copy.aiLine.label;
    if (preview) {
      switch (preview.status) {
        case 'shown':
          // Design preview only: the Monte Carlo fixture's median path, never shown as a real estimate.
          return { status: 'shown', label, points: monteCarloDemo.bands.map((b) => ({ year: b.year, netWorth: b.p50 })) };
        case 'rejected': {
          const reason = preview.reason ?? 'outsideBand';
          return { status: 'rejected', label, reason, reasonMessage: copy.aiLine.rejected[reason] };
        }
        case 'off':
        case 'loading':
          return { status: preview.status, label };
      }
    }
    if (!scenario) return { status: 'off', label };
    if (!current) return { status: 'loading', label };
    if (!current.bundle || current.bundle.source !== 'ai') return { status: 'off', label };
    const shownBand = band && band.inputs === inputs && band.scenario === scenario ? band : null;
    if (!shownBand) return { status: 'loading', label };
    if (!shownBand.result) return { status: 'off', label };
    const asOfMonth = Number(inputs.profile.asOf!.slice(5, 7));
    const points = aiLinePoints(current.bundle, planFor(inputs, scenario), scenario, asOfMonth);
    const reason = aiLineRejection(current.bundle, points, shownBand.result, planTodayNetWorth(inputs));
    if (reason) return { status: 'rejected', label, reason, reasonMessage: copy.aiLine.rejected[reason] };
    return { status: 'shown', label, points };
  }, [preview, scenario, current, band, inputs]);
}
