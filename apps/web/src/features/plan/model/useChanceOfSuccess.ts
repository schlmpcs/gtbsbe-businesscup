// "Chance of success": the Monte Carlo gauge, bands, sample paths, histograms and settings. Fixture
// backed: run() flips straight to 'done' with monteCarlo.demo.json. MP7b runs the seeded simulation in a
// Web Worker (monteCarlo.worker.ts) and cancels the previous run when settings change.
import { monteCarloDemo } from '@lifeguessr/data/fixtures/plan';
import { ASSET_GROUPS, type MonteCarloSettings } from '@lifeguessr/types';
import { useCallback, useMemo } from 'react';
import { plan as copy } from '@/copy';
import { formatMoney } from '@/lib/format';
import { pct } from './planFormat';
import { usePlanStore } from './planStore';
import type { ChanceOfSuccessVM, ChanceResultVM, ChanceSettingsPatch, ChanceSettingsVM, HistogramVM } from './types';

export const PATHS_LIMITS = { min: 1, max: 5000 } as const;
/** A plan "works" in at least this share of paths. */
export const GOOD_SUCCESS_RATE = 0.8;

const compact = (v: number) => formatMoney(v, { compact: true });

function resultVM(): ChanceResultVM {
  const r = monteCarloDemo;
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
  const status = usePlanStore((s) => s.chanceStatus);
  const settings = usePlanStore((s) => s.chanceSettings);
  const setChance = usePlanStore((s) => s.setChance);

  const run = useCallback(() => setChance({ chanceStatus: 'done' }), [setChance]);

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
      // A new setting makes the shown result stale: go back to idle (MP7b: cancel the running worker).
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
      result: status === 'done' ? resultVM() : null,
      settings: settingsVM(settings),
      idleMessage: copy.chance.idle,
      run,
      updateSettings,
      setFixedSeed,
    }),
    [status, settings, run, updateSettings, setFixedSeed],
  );
}
