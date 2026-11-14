// Ladder progress, compact: one row of rung pills (done / not yet / this step, read out to screen
// readers), the 10-year number with its range, how far the user's own numbers have narrowed that
// band (the explanation is collapsed), then one primary CTA and the other as a ghost link.
import { useId } from 'react';
import { forecast, ladder, screenTitles } from '@/copy';
import { buttonClassName, Card, cx, EstimateTag, formatMoney, formatRate, Stack, Tag } from '@/ui-kit';
import type { LadderProgressVM, LadderScreen } from '../model/types';

const t = ladder.shell;

export type LadderProgressProps = { screen: LadderScreen; progress: LadderProgressVM };

export function LadderProgress({ screen, progress }: LadderProgressProps) {
  const { rungs, in10y, estimates, bandNarrowed, doneCount } = progress;
  const ready = progress.status === 'ready';
  const index = rungs.findIndex((r) => r.screen === screen);
  const next = index >= 0 ? rungs[index + 1] : undefined;
  const narrowedId = useId();
  // The big orange CTA: the next rung, except from the balance sheet on (S9 is optional), where the
  // frames lead straight to the forecast.
  const futureFirst = !next || screen === 'S8';

  return (
    <Stack gap="lg">
      <Card>
        <Stack gap="lg">
          <nav aria-label={t.stepsLabel}>
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
                        'flex items-center gap-xs rounded-full border-2 py-xs pr-md pl-xs text-sm',
                        isCurrent
                          ? 'border-text bg-surface font-semibold'
                          : 'border-transparent bg-surface-strong hover:border-border',
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cx(
                          'flex size-xl shrink-0 items-center justify-center rounded-full text-xs font-bold',
                          rung.done
                            ? 'bg-positive text-on-primary'
                            : isCurrent
                              ? 'bg-ink text-on-primary'
                              : 'bg-surface text-text-muted',
                        )}
                      >
                        {rung.done ? '✓' : i + 1}
                      </span>
                      {t.rungs[rung.screen]}
                      <span className="sr-only">({state})</span>
                    </a>
                  </li>
                );
              })}
            </ol>
          </nav>

          {ready && (
            <div className="grid gap-lg sm:grid-cols-2 sm:items-end">
              <div className="flex flex-col gap-xs">
                <span className="flex flex-wrap items-center gap-sm text-sm font-medium text-text-muted">
                  {t.in10yLabel}
                  {estimates.left > 0 && <EstimateTag />}
                </span>
                <div data-testid="ladder-in10y">
                  <p className="font-display text-4xl font-extrabold leading-display text-primary tabular-nums">
                    {formatMoney(in10y.mid)}
                  </p>
                  {progress.in10ySource === 'rules' && (
                    <Tag data-testid="ladder-in10y-source" className="mt-xs">
                      {forecast.source.rulesPreview}
                    </Tag>
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
            </div>
          )}
        </Stack>
      </Card>

      <div className="flex flex-col-reverse gap-md sm:flex-row sm:items-center sm:justify-end">
        <a
          href={progress.futureHref}
          className={buttonClassName({ variant: futureFirst ? 'primary' : 'ghost', size: 'lg' })}
        >
          {t.futureCta}
        </a>
        {next && (
          <a
            href={next.href}
            className={cx(
              buttonClassName({ variant: futureFirst ? 'ghost' : 'primary', size: 'lg' }),
              futureFirst ? 'sm:order-first' : 'sm:order-last',
            )}
          >
            {t.next(screenTitles[next.screen])}
          </a>
        )}
      </div>
    </Stack>
  );
}
