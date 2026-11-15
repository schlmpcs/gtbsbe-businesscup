// "Chance of success": the Monte Carlo gauge, bands, sample paths, histograms and settings. run()
// sends monteCarlo() (MP5) of the active scenario to a Web Worker (monteCarlo.worker.ts) with the
// settings' seed, or a new one when the fixed seed is off; a settings or plan change cancels the run in
// progress and drops the result (planStore.ts).
import { ASSET_GROUPS, type MonteCarloResult, type MonteCarloSettings } from '@lifeguessr/types';
import { useCallback, useMemo } from 'react';
import { plan as copy } from '@/copy';
import { track } from '@/lib/events';
import { formatMoney } from '@/lib/format';
import { pct } from './planFormat';
import { usePlanInputs } from './planInputs';
import { usePlanStore } from './planStore';
import type { ChanceOfSuccessVM, ChanceResultVM, ChanceSettingsPatch, ChanceSettingsVM, HistogramVM } from './types';

export const PATHS_LIMITS = { min: 1, max: 5000 } as const;
/** A plan "works" in at least this share of paths. */
export const GOOD_SUCCESS_RATE = 0.8;

const compact = (v: number) => formatMoney(v, { compact: true });

export function resultVM(r: MonteCarloResult): ChanceResultVM {
  const successfulPaths = Math.round(r.successRate * r.paths);
  const bins = (id: HistogramVM['id'], label: (n: number) => string): HistogramVM => ({
    id,
    title: copy.chance.histograms[id].title,
    xLabel: copy.chance.histograms[id].xLabel,
    bins: r.histograms[id].map((b) => ({ ...b, label: `${label(b.from)} to ${label(b.to)}` })),
  });
  return {
    gaugePct: Math.round(r.successRate * 100),
    gaugeLabel: pct(r.successRate, 0),
    tone: r.successRate >= GOOD_SUCCESS_RATE ? 'good' : 'bad',
    pathsLabel: copy.chance.paths(successfulPaths.toLocaleString('en-US'), r.paths.toLocaleString('en-US')),
    successfulPaths,
    paths: r.paths,
    seed: r.seed,
    bands: r.bands.map((b) => ({ ...b })),
    // A sample path has one value per band year.
    samplePaths: r.samplePaths.map((p) => ({
      success: p.success,
      points: p.netWorth.map((netWorth, j) => ({ year: r.bands[0]!.year + j, netWorth })),
    })),
    histograms: [bins('atRetirement', compact), bins('atEnd', compact), bins('shortfallAge', (n) => String(n))],
  };
}

function settingsVM(s: MonteCarloSettings): ChanceSettingsVM {
  const l = copy.chance.settings;
  const h = copy.chance.hints;
  return {
    paths: s.paths,
    fixedSeed: s.seed !== null,
    seed: s.seed,
    inflation: { ...s.inflation },
    endThreshold: s.endThreshold,
    growth: ASSET_GROUPS.filter((g) => s.growth[g]).map((group) => ({ group, label: copy.groups[group], mean: s.growth[group]!.mean, sd: s.growth[group]!.sd })),
    fields: [
      { key: 'paths', label: l.paths!, hint: h.paths!, display: s.paths.toLocaleString('en-US') },
      { key: 'fixedSeed', label: l.fixedSeed!, hint: h.fixedSeed!, display: s.seed !== null ? String(s.seed) : '' },
      { key: 'inflationMean', label: l.inflationMean!, hint: null, display: pct(s.inflation.mean, 1) },
      { key: 'inflationSd', label: l.inflationSd!, hint: h.inflationSd!, display: pct(s.inflation.sd, 1) },
      { key: 'endThreshold', label: l.endThreshold!, hint: h.endThreshold!, display: formatMoney(s.endThreshold) },
    ],
    limits: { paths: { ...PATHS_LIMITS } },
  };
}

export function useChanceOfSuccess(): ChanceOfSuccessVM {
  const inputs = usePlanInputs();
  const storedStatus = usePlanStore((s) => s.chanceStatus);
  const runOf = usePlanStore((s) => s.chanceRunOf);
  const scenario = usePlanStore((s) => s.scenarios.find((x) => x.id === s.activeId));
  // A run made from other inputs (the profile or the accounts changed since) or another version of the
  // scenario is not this plan's: it shows as idle.
  const status = runOf && runOf.inputs === inputs && runOf.scenario === scenario ? storedStatus : 'idle';
  const settings = usePlanStore((s) => s.chanceSettings);
  const result = usePlanStore((s) => s.chanceResult);
  const setChance = usePlanStore((s) => s.setChance);
  const runChance = usePlanStore((s) => s.runChance);

  const run = useCallback(() => {
    const { scenarios, activeId, chanceSettings } = usePlanStore.getState();
    const scenario = scenarios.find((s) => s.id === activeId);
    if (!scenario) return;
    runChance(inputs, scenario);
    track({ name: 'chance_run', props: { paths: chanceSettings.paths, fixedSeed: chanceSettings.seed !== null } });
  }, [inputs, runChance]);

  const updateSettings = useCallback(
    (patch: ChanceSettingsPatch) => {
      const cur = usePlanStore.getState().chanceSettings;
      const next: MonteCarloSettings = { ...cur };
      if (patch.paths !== undefined && Number.isFinite(patch.paths)) {
        next.paths = Math.min(PATHS_LIMITS.max, Math.max(PATHS_LIMITS.min, Math.round(patch.paths)));
      }
      if (patch.seed !== undefined) next.seed = patch.seed;
      if (patch.inflation) next.inflation = { mean: Math.max(0, patch.inflation.mean), sd: Math.max(0, patch.inflation.sd) };
      if (patch.endThreshold !== undefined && Number.isFinite(patch.endThreshold)) next.endThreshold = patch.endThreshold;
      // A new setting makes the shown result stale: back to idle, and the running worker is cancelled.
      setChance({ chanceSettings: next, chanceStatus: 'idle', ...(next.seed !== null ? { fixedSeed: next.seed } : {}) });
    },
    [setChance],
  );

  const setFixedSeed = useCallback(
    (fixed: boolean) => {
      const { chanceSettings, fixedSeed } = usePlanStore.getState();
      setChance({ chanceSettings: { ...chanceSettings, seed: fixed ? fixedSeed : null }, chanceStatus: 'idle' });
    },
    [setChance],
  );

  return useMemo(
    () => ({
      status,
      result: status === 'done' && result ? resultVM(result) : null,
      settings: settingsVM(settings),
      idleMessage: copy.chance.idle,
      run,
      updateSettings,
      setFixedSeed,
    }),
    [status, settings, result, run, updateSettings, setFixedSeed],
  );
}
