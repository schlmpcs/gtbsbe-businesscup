// Ladder progress: the five rungs (done / not yet / this step), the 10-year number with its range
// band, how far the user's own numbers have narrowed that band, the next rung and "See your future".
// Styled as the Figma tiles: a white tile with the rungs as pills and a big orange 10-year number,
// then the big orange CTA.
import { useId } from 'react';
import { ladder, screenTitles } from '@/copy';
import { buttonClassName, Card, cx, EstimateTag, formatMoney, formatRate, Stack } from '@/ui-kit';
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
    <Stack gap="xl">
      <Card title={t.progressTitle} as="section">
        <Stack gap="xl">
          <nav aria-label={t.stepsLabel}>
            <p className="mb-sm text-sm text-text-muted">{ready ? t.stepsDone(doneCount, rungs.length) : t.loading}</p>
            <ol className="grid grid-cols-1 gap-sm sm:grid-cols-5">
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
                        'flex h-full items-center gap-sm rounded-lg border-2 px-md py-sm text-sm',
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
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="leading-tight">{t.rungs[rung.screen]}</span>
                        <span className={cx('text-xs font-normal', rung.done ? 'text-positive' : 'text-text-muted')}>
                          {state}
                        </span>
                      </span>
                    </a>
                  </li>
                );
              })}
            </ol>
          </nav>

          {ready && (
            <div className="grid gap-xl lg:grid-cols-2 lg:items-end">
              <div className="flex flex-col gap-xs">
                <span className="flex flex-wrap items-center gap-sm text-sm font-medium text-text-muted">
                  {t.in10yLabel}
                  {estimates.left > 0 && <EstimateTag />}
                </span>
                <div data-testid="ladder-in10y">
                  <p className="font-display text-4xl font-extrabold leading-display text-primary tabular-nums sm:text-display">
                    {formatMoney(in10y.mid)}
                  </p>
                </div>
                <p className="text-sm text-text-muted">{t.in10yHint}</p>
                <p className="text-sm font-medium tabular-nums" data-testid="ladder-range">
                  {t.range(formatMoney(in10y.low), formatMoney(in10y.high))}
                </p>
              </div>

              <div className="flex flex-col gap-sm">
                <div className="flex items-baseline justify-between gap-md text-sm">
                  <span id={narrowedId} className="font-medium">
                    {t.narrowedLabel}
                  </span>
                  <span className="font-display text-2xl font-extrabold tabular-nums">{formatRate(bandNarrowed, 0)}</span>
                </div>
                <div
                  role="progressbar"
                  aria-labelledby={narrowedId}
                  aria-valuemin={0}
                  aria-valuemax={1}
                  aria-valuenow={bandNarrowed}
                  aria-valuetext={t.narrowed(formatRate(bandNarrowed, 0))}
                  className="h-md w-full overflow-hidden rounded-full bg-surface-strong"
                >
                  <div
                    className="h-full origin-left rounded-full bg-positive transition-transform duration-500"
                    style={{ transform: `scaleX(${bandNarrowed})` }}
                  />
                </div>
                <p className="text-xs text-text-muted">
                  {t.estimatesLeft(estimates.left, estimates.total)} {t.bandNote}
                </p>
              </div>
            </div>
          )}
        </Stack>
      </Card>

      <div className="flex flex-col-reverse gap-md sm:flex-row sm:items-center sm:justify-end">
        <a
          href={progress.futureHref}
          className={buttonClassName({ variant: futureFirst ? 'primary' : 'secondary', size: 'lg' })}
        >
          {t.futureCta}
        </a>
        {next && (
          <a
            href={next.href}
            className={cx(
              buttonClassName({ variant: futureFirst ? 'secondary' : 'primary', size: 'lg' }),
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
