// Ladder progress, Design v3. LadderSteps: one row of numbered step pills (this step = ink, done =
// soft green with ✓, not yet = white; the state is read out to screen readers). LadderPreview: a
// compact white strip with the 10-year number and its range, how far the user's own numbers have
// narrowed that band (the explanation is collapsed), and a text link to the forecast.
import { useId } from 'react';
import { forecast, ladder } from '@/copy';
import { cx, EstimateTag, formatMoney, formatRate, Tag } from '@/ui-kit';
import type { LadderProgressVM, LadderScreen } from '../model/types';

const t = ladder.shell;

export type LadderProgressProps = { screen: LadderScreen; progress: LadderProgressVM };

export function LadderSteps({ screen, progress }: LadderProgressProps) {
  const { rungs, doneCount } = progress;
  const ready = progress.status === 'ready';
  return (
    <nav aria-label={t.stepsLabel} className="min-w-0">
      <p className="sr-only">{ready ? t.stepsDone(doneCount, rungs.length) : t.loading}</p>
      <ol className="flex flex-wrap gap-sm">
        {rungs.map((rung, i) => {
          const isCurrent = rung.screen === screen;
          const state = isCurrent ? t.current : rung.done ? t.done : t.notYet;
          return (
            <li key={rung.screen} className="min-w-0">
              <a
                href={rung.href}
                aria-current={isCurrent ? 'step' : undefined}
                data-rung={rung.screen}
                data-done={rung.done ? 'true' : 'false'}
                className={cx(
                  'flex min-h-11 items-center gap-xs rounded-full px-md text-sm font-semibold transition-colors sm:min-h-0 sm:py-xs',
                  isCurrent
                    ? 'bg-ink text-on-primary'
                    : rung.done
                      ? 'bg-positive-soft text-positive hover:bg-surface'
                      : 'bg-surface text-text-muted hover:text-text',
                )}
              >
                <span className="tabular-nums">{i + 1}</span>
                {t.rungs[rung.screen]}
                {rung.done && <span aria-hidden="true">✓</span>}
                <span className="sr-only">({state})</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function LadderPreview({ progress }: { progress: LadderProgressVM }) {
  const { in10y, estimates, bandNarrowed } = progress;
  const narrowedId = useId();
  if (progress.status !== 'ready') return null;

  return (
    <section
      aria-label={t.in10yLabel}
      className="grid gap-lg rounded-xl bg-surface p-xl shadow-md md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center"
    >
      <div className="flex flex-col gap-xs">
        <span className="flex flex-wrap items-center gap-sm text-sm font-semibold text-text-muted">
          {t.in10yLabel}
          {estimates.left > 0 && <EstimateTag />}
        </span>
        <div data-testid="ladder-in10y" className="flex flex-wrap items-center gap-sm">
          <p className="font-display text-4xl font-extrabold leading-display text-primary tabular-nums">
            {formatMoney(in10y.mid)}
          </p>
          {progress.in10ySource === 'rules' && (
            <Tag data-testid="ladder-in10y-source">{forecast.source.rulesPreview}</Tag>
          )}
        </div>
        <p className="text-xs text-text-muted tabular-nums" data-testid="ladder-range">
          {t.range(formatMoney(in10y.low), formatMoney(in10y.high))}
        </p>
      </div>

      <div className="flex flex-col gap-xs">
        <div className="flex items-baseline justify-between gap-md text-sm">
          <span id={narrowedId} className="font-medium">
            {t.narrowedLabel}
          </span>
          <span className="font-bold tabular-nums">{formatRate(bandNarrowed, 0)}</span>
        </div>
        <div
          role="progressbar"
          aria-labelledby={narrowedId}
          aria-valuemin={0}
          aria-valuemax={1}
          aria-valuenow={bandNarrowed}
          aria-valuetext={t.narrowed(formatRate(bandNarrowed, 0))}
          className="h-sm w-full overflow-hidden rounded-full bg-surface-strong"
        >
          <div
            className="h-full origin-left rounded-full bg-positive transition-transform duration-500"
            style={{ transform: `scaleX(${bandNarrowed})` }}
          />
        </div>
        <details className="text-xs text-text-muted">
          <summary className="cursor-pointer">
            {t.estimatesLeft(estimates.left, estimates.total)} · {t.howTitle}
          </summary>
          <p className="mt-xs">
            {t.in10yHint} {t.bandNote}
          </p>
        </details>
      </div>

      <a href={progress.futureHref} className="text-base font-bold text-primary hover:underline md:justify-self-end">
        {t.futureCta}
      </a>
    </section>
  );
}
