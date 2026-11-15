'use client';

// Plan › Chance of success (useChanceOfSuccess): a semicircle gauge with the big percentage and how many
// paths work, "Run again", three compact histograms with the plan's own value marked, and the paths
// chart (faint sampled paths + median, or the p10–p90 range) with a sideways histogram of end values.
// The settings (`ChanceSettings`) sit in the right-hand panel. Nothing here simulates: run() and the
// settings go to the hook, and the result arrives computed. The gauge sweeps, the bars grow and the
// lines draw in (CSS; none with reduced motion).
import { useState } from 'react';
import { plan as copy } from '@/copy';
import { Button, Field, NumberInput, cx, formatRate } from '@/ui-kit';
import type { ChanceOfSuccessVM, ChanceResultVM, HistogramVM } from '../model/types';
import { PanelSection } from './AssumptionsPanel';
import { LineChart } from './LineChart';
import { MOTION, useEntered } from './motion';

type Mode = 'paths' | 'range';

export function ChanceView({ vm }: { vm: ChanceOfSuccessVM }) {
  const t = copy.screen.chance;
  const r = vm.result;
  // Each finished run replays the entrance.
  const runKey = r ? `${r.seed}-${r.successfulPaths}-${r.paths}` : 'none';

  return (
    <div className="flex min-w-0 flex-col gap-lg">
      <section aria-labelledby="chance-title" className="card card-pad flex min-w-0 flex-col gap-lg">
        <div className="flex flex-col gap-xs">
          <h2 id="chance-title" className="text-lg font-bold">{copy.chance.gaugeLabel}</h2>
          <p className="text-sm text-text-muted">{t.intro}</p>
        </div>

        <div className="grid gap-xl md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] md:items-center">
          <div className="flex flex-col items-center gap-md">
            <SuccessGauge result={r} runKey={runKey} />
            {vm.status === 'running' && (
              <p role="status" className="text-sm font-medium">
                {copy.chance.running}
              </p>
            )}
            {(vm.status === 'idle' || vm.status === 'error') && (
              <p className="text-center text-sm" role={vm.status === 'error' ? 'alert' : undefined}>
                {vm.status === 'error' ? vm.errorMessage : vm.idleMessage}
              </p>
            )}
            {r ? (
              <Button onClick={vm.run}>{t.rerun}</Button>
            ) : (
              <Button onClick={vm.run} disabled={vm.status === 'running'}>
                {t.run}
              </Button>
            )}
            {r && <p className="text-xs text-text-muted">{t.seedLabel(r.seed)}</p>}
          </div>

          <div className="flex min-w-0 flex-col gap-lg">
            {r ? (
              r.histograms.map((h) => <Histogram key={h.id} h={h} runKey={runKey} />)
            ) : (
              <p className="text-sm text-text-muted">{t.histogramsTitle}: {t.empty}</p>
            )}
          </div>
        </div>
      </section>

      {r && r.bands.length > 0 && <PathsCard r={r} runKey={runKey} />}
    </div>
  );
}

/** Semicircle gauge: the arc sweeps from 0 to the share of paths that work. */
function SuccessGauge({ result: r, runKey }: { result: ChanceResultVM | null; runKey: string }) {
  const t = copy.screen.chance;
  const entered = useEntered(runKey);
  const pct = r?.gaugePct ?? 0;
  const color = r?.tone === 'bad' ? 'var(--color-negative)' : 'var(--color-positive)';
  const arc = 'M 20 110 A 90 90 0 0 1 200 110';
  return (
    <div
      className="relative w-full max-w-64"
      {...(r ? { role: 'meter', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': r.gaugePct, 'aria-label': t.barLabel(r.gaugeLabel) } : {})}
    >
      <svg aria-hidden="true" viewBox="0 0 220 124" className="w-full">
        <path d={arc} fill="none" stroke="var(--color-surface-strong)" strokeWidth={18} strokeLinecap="round" />
        {r && (
          <path
            d={arc}
            fill="none"
            stroke={color}
            strokeWidth={18}
            strokeLinecap="round"
            pathLength={100}
            className="transition-[stroke-dasharray] duration-1000 ease-out motion-reduce:transition-none"
            style={{ strokeDasharray: `${entered ? pct : 0} 100` }}
          />
        )}
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
        <span
          data-testid={r ? 'chance-pct' : undefined}
          className={cx(
            'font-display text-4xl font-extrabold leading-display tabular-nums sm:text-display',
            !r ? 'text-text-muted' : r.tone === 'bad' ? 'text-negative' : 'text-positive',
          )}
        >
          {r ? r.gaugeLabel : t.empty}
        </span>
        {r && <span className="text-sm text-text-muted">{r.pathsLabel}</span>}
      </div>
    </div>
  );
}

/** A compact histogram: bars grow from the base; the plan's own value is a marked line. */
function Histogram({ h, runKey }: { h: HistogramVM; runKey: string }) {
  const t = copy.screen.chance;
  const entered = useEntered(runKey);
  const max = Math.max(1, ...h.bins.map((b) => b.count));
  const lo = h.bins[0]?.from ?? 0;
  const hi = h.bins[h.bins.length - 1]?.to ?? 1;
  const at = h.planValue !== null && hi > lo ? Math.min(1, Math.max(0, (h.planValue - lo) / (hi - lo))) : null;

  return (
    <figure className="flex min-w-0 flex-col gap-xs" data-histogram={h.id}>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-sm text-sm">
        <span className="font-semibold">{h.title}</span>
        {h.planLabel && <span className="text-xs font-semibold text-primary">{h.planLabel}</span>}
      </figcaption>
      {h.bins.length === 0 ? (
        <p className="text-xs text-text-muted">{t.noShortfall}</p>
      ) : (
        <>
          <div className="relative">
            <div className="flex h-16 items-end gap-0.5" role="list" aria-label={h.title}>
              {h.bins.map((b, i) => (
                <div
                  key={`${b.from}-${b.to}`}
                  role="listitem"
                  title={`${b.label}: ${b.count}`}
                  aria-label={`${b.label}: ${b.count}`}
                  className={cx('min-w-0 flex-1 origin-bottom rounded-t-sm bg-chart-1/70', MOTION)}
                  style={{ height: `${(b.count / max) * 100}%`, transform: entered ? 'scaleY(1)' : 'scaleY(0)', transitionDelay: `${i * 18}ms` }}
                />
              ))}
            </div>
            {at !== null && (
              <span aria-hidden="true" className="absolute -top-xs bottom-0 w-0.5 -translate-x-1/2 rounded-full bg-primary" style={{ left: `${at * 100}%` }} />
            )}
          </div>
          <div aria-hidden="true" className="flex justify-between text-xs tabular-nums text-text-muted">
            <span>{h.bins[0]?.label.split(' to ')[0]}</span>
            <span>{h.xLabel}</span>
            <span>{h.bins[h.bins.length - 1]?.label.split(' to ')[1]}</span>
          </div>
        </>
      )}
    </figure>
  );
}

function PathsCard({ r, runKey }: { r: ChanceResultVM; runKey: string }) {
  const t = copy.screen.chance;
  const [mode, setMode] = useState<Mode>('paths');
  const atEnd = r.histograms.find((h) => h.id === 'atEnd');
  // The y range follows the middle of the outcomes; extreme paths run off the top (clipped).
  const lo = Math.min(0, ...r.bands.map((b) => b.p10));
  const hi = Math.max(...r.bands.map((b) => b.p90)) * 1.25;
  const median = { id: 'p50', label: t.median, color: 'var(--color-primary)', strong: true, points: r.bands.map((b) => ({ x: b.year, y: b.p50 })) };

  return (
    <section aria-labelledby="chance-paths" className="card card-pad flex min-w-0 flex-col gap-md">
      <div className="flex flex-wrap items-center justify-between gap-sm">
        <h2 id="chance-paths" className="text-lg font-bold">{t.fanTitle}</h2>
        <div role="group" aria-label={t.modeLabel} className="flex rounded-full bg-surface-strong p-xs text-xs">
          {(['paths', 'range'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={cx('min-h-9 rounded-full px-md font-semibold', mode === m ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text')}
            >
              {t.modes[m]}
            </button>
          ))}
        </div>
      </div>
      <LineChart
        title={t.fanTitle}
        animateKey={`${runKey}-${mode}`}
        heightClass="h-64 sm:h-80"
        yDomain={[lo, hi]}
        series={[median]}
        {...(mode === 'paths'
          ? {
              paths: { label: t.sampled, lines: r.samplePaths.map((p) => ({ bad: !p.success, points: p.points.map((q) => ({ x: q.year, y: q.netWorth })) })) },
              ...(atEnd && atEnd.bins.length > 0 ? { side: { label: t.endValues, bins: atEnd.bins } } : {}),
            }
          : { band: { label: t.band, points: r.bands.map((b) => ({ x: b.year, lo: b.p10, hi: b.p90 })) } })}
        legend
        xTicks={r.bands.filter((b, i) => i === 0 || b.year % 10 === 0).map((b) => ({ x: b.year, label: String(b.year) }))}
        xLabel={(year) => String(year)}
      />
    </section>
  );
}

/** The simulation settings, for the right-hand panel: success criteria, inflation, advanced. */
export function ChanceSettings({ vm }: { vm: ChanceOfSuccessVM }) {
  const t = copy.screen.chance;
  const s = vm.settings;
  const field = (key: (typeof s.fields)[number]['key']) => s.fields.find((f) => f.key === key);
  const paths = field('paths');
  const seed = field('fixedSeed');
  const infl = field('inflationMean');
  const inflSd = field('inflationSd');
  const end = field('endThreshold');

  return (
    <div className="flex flex-col">
      <PanelSection title={t.sections.criteria}>
        {end && (
          <Field label={end.label} hint={end.hint ?? undefined}>
            <NumberInput
              value={s.endThreshold}
              prefix="$"
              onValueChange={(v) => {
                if (v !== null) vm.updateSettings({ endThreshold: v });
              }}
            />
          </Field>
        )}
      </PanelSection>

      <PanelSection title={t.sections.inflation}>
        {infl && (
          <Field label={infl.label} hint={infl.hint ?? undefined}>
            <NumberInput
              value={s.inflation.mean}
              percent
              max={0.2}
              suffix="%"
              onValueChange={(v) => {
                if (v !== null) vm.updateSettings({ inflation: { mean: v, sd: s.inflation.sd } });
              }}
            />
          </Field>
        )}
        {inflSd && (
          <Field label={inflSd.label} hint={inflSd.hint ?? undefined}>
            <NumberInput
              value={s.inflation.sd}
              percent
              max={0.2}
              suffix="%"
              onValueChange={(v) => {
                if (v !== null) vm.updateSettings({ inflation: { mean: s.inflation.mean, sd: v } });
              }}
            />
          </Field>
        )}
      </PanelSection>

      <PanelSection title={t.sections.advanced} defaultOpen={false}>
        {paths && (
          <Field label={paths.label} hint={paths.hint ?? undefined}>
            <NumberInput
              value={s.paths}
              min={s.limits.paths.min}
              max={s.limits.paths.max}
              maxFractionDigits={0}
              suffix={t.paths}
              onValueChange={(v) => {
                if (v !== null) vm.updateSettings({ paths: v });
              }}
            />
          </Field>
        )}
        {seed && (
          <div className="flex flex-col gap-xs">
            <label className="flex min-h-11 items-center justify-between gap-md text-sm font-medium">
              <span>{seed.label}</span>
              <input type="checkbox" checked={s.fixedSeed} onChange={(e) => vm.setFixedSeed(e.target.checked)} className="size-lg accent-(--color-primary)" />
            </label>
            {seed.hint && <p className="text-xs text-text-muted">{seed.hint}</p>}
          </div>
        )}
        {s.growth.length > 0 && (
          <div className="flex flex-col gap-xs">
            <p className="text-sm font-medium">{t.growthTitle}</p>
            <dl className="flex flex-col gap-xs text-sm">
              {s.growth.map((g) => (
                <div key={g.group} className="flex justify-between gap-md">
                  <dt className="text-text-muted">{g.label}</dt>
                  <dd className="tabular-nums">
                    {formatRate(g.mean, 1)} ± {formatRate(g.sd, 1)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </PanelSection>
    </div>
  );
}
