// "Chance of success": the Monte Carlo gauge, bands, sample paths, histograms and settings. run() runs
// the engine's seeded monteCarlo() (packages/engine/monteCarlo.ts) on the active scenario, with the
// person's profile, accounts and area and the scenario's applied moves, on demand: the 'running' state
// paints first, then the run (~0.3 s for 1,000 paths) happens on the next task. A change to the plan or
// the settings while it runs drops its result (planStore.finishChanceRun). An error shows as 'error'.
// TODO(MP7): move the run into a Web Worker so the page stays responsive during it.
//
// Growth draws: unless the person set them, investments and retirement draw around the plan's own
// return (the scenario's override, else returnAnnualNominal) and real estate around the area's home
// appreciation, so the median path tracks plan(). The spreads are the spec's assumptions
// (docs/ENGINEERING.md → Monte Carlo: sd 0.15 for investments and retirement, 0.05 for real estate).
import { monteCarlo } from '@lifeguessr/engine';
import { ASSET_GROUPS, type AccountGroup, type AreaData, type MonteCarloResult, type MonteCarloSettings, type Scenario } from '@lifeguessr/types';
import { useCallback, useMemo } from 'react';
import { plan as copy } from '@/copy';
import { formatMoney } from '@/lib/format';
import { NO_MOVES, profileFor, usePlanInputs } from './planEngine';
import { pct } from './planFormat';
import { usePlanStore } from './planStore';
import { growthDefaults } from './useAssumptions';
import type { ChanceOfSuccessVM, ChanceResultVM, ChanceSettingsPatch, ChanceSettingsVM, HistogramVM } from './types';

export const PATHS_LIMITS = { min: 1, max: 5000 } as const;
/** A plan "works" in at least this share of paths. */
export const GOOD_SUCCESS_RATE = 0.8;

const compact = (v: number) => formatMoney(v, { compact: true });

/** Spread of the yearly growth draws per group (docs/ENGINEERING.md → Monte Carlo; assumptions). */
export const GROWTH_SD: Partial<Record<AccountGroup, number>> = { investments: 0.15, retirement: 0.15, realEstate: 0.05 };

/** The settings a run uses: the person's, with growth draws around the plan's own rates for groups they left alone. */
export function effectiveSettings(settings: MonteCarloSettings, scenario: Scenario | undefined, area: AreaData | undefined): MonteCarloSettings {
  if (!scenario) return settings;
  const defaults = growthDefaults(area, scenario.assumptions.inflation);
  const growth: MonteCarloSettings['growth'] = {};
  for (const g of ASSET_GROUPS) {
    const sd = GROWTH_SD[g];
    if (sd !== undefined) growth[g] = { mean: scenario.assumptions.growth[g] ?? defaults[g], sd };
  }
  return { ...settings, growth: { ...growth, ...settings.growth } };
}

function resultVM(r: MonteCarloResult): ChanceResultVM {
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
  const stored = usePlanStore((s) => s.chanceSettings);
  const result = usePlanStore((s) => s.chanceResult);
  const scenario = usePlanStore((s) => s.scenarios.find((x) => x.id === s.activeId));
  const moves = usePlanStore((s) => s.movesApplied[s.activeId] ?? NO_MOVES);
  const setChance = usePlanStore((s) => s.setChance);
  const inputs = usePlanInputs();
  const settings = useMemo(() => effectiveSettings(stored, scenario, inputs.area), [stored, scenario, inputs.area]);

  const run = useCallback(() => {
    if (!scenario) return;
    const { startChanceRun, finishChanceRun } = usePlanStore.getState();
    const id = startChanceRun();
    const profile = profileFor(inputs, moves);
    setTimeout(() => {
      // A change since the click makes this run stale: skip it (finishChanceRun would drop it anyway).
      if (usePlanStore.getState().chanceRun !== id) return;
      let r: MonteCarloResult | null = null;
      try {
        r = monteCarlo(profile, inputs.accounts, scenario, settings, inputs.area);
      } catch (err) {
        console.error('monteCarlo failed', err);
      }
      finishChanceRun(id, r);
    }, 0);
  }, [scenario, moves, inputs, settings]);

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
      setChance({ chanceSettings: next, chanceStatus: 'idle', chanceResult: null, ...(next.seed !== null ? { fixedSeed: next.seed } : {}) });
    },
    [setChance],
  );

  const setFixedSeed = useCallback(
    (fixed: boolean) => {
      const { chanceSettings, fixedSeed } = usePlanStore.getState();
      setChance({ chanceSettings: { ...chanceSettings, seed: fixed ? fixedSeed : null }, chanceStatus: 'idle', chanceResult: null });
    },
    [setChance],
  );

  return useMemo(
    () => ({
      status,
      result: status === 'done' && result ? resultVM(result) : null,
      settings: settingsVM(settings),
      idleMessage: copy.chance.idle,
      errorMessage: status === 'error' ? copy.chance.error : null,
      run,
      updateSettings,
      setFixedSeed,
    }),
    [status, result, settings, run, updateSettings, setFixedSeed],
  );
}
