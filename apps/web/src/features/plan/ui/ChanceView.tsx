'use client';

// Plan › Chance of success (useChanceOfSuccess): the big percentage with a bar, the p10–p90 fan with the
// median, the histograms and the simulation settings. Nothing here simulates: run() and the settings go
// to the hook, and the result arrives computed.
import { plan as copy } from '@/copy';
import { Button, Card, Field, NumberInput, cx, formatRate } from '@/ui-kit';
import type { ChanceOfSuccessVM, HistogramVM } from '../model/types';
import { LineChart } from './LineChart';

export function ChanceView({ vm }: { vm: ChanceOfSuccessVM }) {
  const t = copy.screen.chance;
  const r = vm.result;

  return (
    <div className="grid gap-xl lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
      <div className="flex min-w-0 flex-col gap-xl">
        <Card title={copy.chance.gaugeLabel}>
          <div className="flex flex-col gap-lg">
            <p className="text-sm text-text-muted">{t.intro}</p>
            {vm.status === 'running' && (
              <p role="status" className="text-sm font-medium">
                {copy.chance.running}
              </p>
            )}
            {vm.status === 'idle' && (
              <div className="flex flex-col items-start gap-md">
                <p className="text-sm">{vm.idleMessage}</p>
                <Button onClick={vm.run}>{t.run}</Button>
              </div>
            )}
            {r && (
              <div className="flex flex-col gap-md">
                <div className="flex flex-wrap items-end justify-between gap-md">
                  <div className="flex flex-col">
                    <span
                      data-testid="chance-pct"
                      className={cx('font-display text-display font-extrabold leading-display tabular-nums', r.tone === 'bad' ? 'text-negative' : 'text-positive')}
                    >
                      {r.gaugeLabel}
                    </span>
                    <span className="text-sm text-text-muted">{r.pathsLabel}</span>
                  </div>
                  <Button variant="secondary" size="sm" onClick={vm.run}>
                    {t.rerun}
                  </Button>
                </div>
                <div
                  role="meter"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={r.gaugePct}
                  aria-label={t.barLabel(r.gaugeLabel)}
                  className="h-md w-full overflow-hidden rounded-full bg-surface-strong"
                >
                  <div className={cx('h-full rounded-full', r.tone === 'bad' ? 'bg-negative' : 'bg-positive')} style={{ width: `${r.gaugePct}%` }} />
                </div>
                <p className="text-xs text-text-muted">{t.seedLabel(r.seed)}</p>
              </div>
            )}
          </div>
        </Card>

        {r && r.bands.length > 0 && (
          <Card title={t.fanTitle}>
            <LineChart
              title={t.fanTitle}
              band={{ label: t.band, points: r.bands.map((b) => ({ x: b.year, lo: b.p10, hi: b.p90 })) }}
              series={[{ id: 'p50', label: t.median, color: 'var(--color-chart-1)', points: r.bands.map((b) => ({ x: b.year, y: b.p50 })) }]}
              xTicks={r.bands.filter((b, i) => i === 0 || b.year % 10 === 0).map((b) => ({ x: b.year, label: String(b.year) }))}
              xCaption={copy.screen.chart.axisYear}
              xLabel={(year) => String(year)}
            />
          </Card>
        )}

        {r && r.histograms.length > 0 && (
          <Card title={t.histogramsTitle}>
            <div className="grid gap-xl md:grid-cols-3">
              {r.histograms.map((h) => (
                <Histogram key={h.id} h={h} />
              ))}
            </div>
          </Card>
        )}
      </div>

      <Settings vm={vm} />
    </div>
  );
}

function Histogram({ h }: { h: HistogramVM }) {
  const max = Math.max(1, ...h.bins.map((b) => b.count));
  return (
    <figure className="flex min-w-0 flex-col gap-sm">
      <figcaption className="text-sm font-semibold">{h.title}</figcaption>
      {h.bins.length === 0 ? (
        <p className="text-xs text-text-muted">—</p>
      ) : (
        <div className="flex h-24 items-end gap-0.5" role="list" aria-label={h.title}>
          {h.bins.map((b) => (
            <div
              key={`${b.from}-${b.to}`}
              role="listitem"
              title={`${b.label}: ${b.count}`}
              aria-label={`${b.label}: ${b.count}`}
              className="min-w-0 flex-1 rounded-t-sm bg-chart-1"
              style={{ height: `${(b.count / max) * 100}%` }}
            />
          ))}
        </div>
      )}
      <span className="text-xs text-text-muted">{h.xLabel}</span>
    </figure>
  );
}

function Settings({ vm }: { vm: ChanceOfSuccessVM }) {
  const t = copy.screen.chance;
  const s = vm.settings;
  const field = (key: (typeof s.fields)[number]['key']) => s.fields.find((f) => f.key === key);
  const paths = field('paths');
  const seed = field('fixedSeed');
  const infl = field('inflationMean');
  const inflSd = field('inflationSd');
  const end = field('endThreshold');

  return (
    <Card title={t.settingsTitle}>
      <div className="flex flex-col gap-md">
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
        {s.growth.length > 0 && (
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
        )}
      </div>
    </Card>
  );
}
