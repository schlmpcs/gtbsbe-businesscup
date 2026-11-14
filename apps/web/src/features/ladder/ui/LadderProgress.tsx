// Ladder progress: the five rungs (done / not yet / this step), the 10-year number with its range
// band, how far the user's own numbers have narrowed that band, the next rung and "See your future".
import { useId } from 'react';
import { ladder, screenTitles } from '@/copy';
import { buttonClassName, Card, cx, formatMoney, formatRate, Row, Stack, Stat } from '@/ui-kit';
import type { LadderProgressVM, LadderScreen } from '../model/types';

const t = ladder.shell;

export type LadderProgressProps = { screen: LadderScreen; progress: LadderProgressVM };

export function LadderProgress({ screen, progress }: LadderProgressProps) {
  const { rungs, in10y, estimates, bandNarrowed, doneCount } = progress;
  const ready = progress.status === 'ready';
  const index = rungs.findIndex((r) => r.screen === screen);
  const next = index >= 0 ? rungs[index + 1] : undefined;
  const narrowedId = useId();

  return (
    <Card title={t.progressTitle} as="section">
      <Stack gap="lg">
        <nav aria-label={t.stepsLabel}>
          <p className="mb-sm text-sm text-text-muted">{ready ? t.stepsDone(doneCount, rungs.length) : t.loading}</p>
          <ol className="flex flex-col gap-xs">
            {rungs.map((rung, i) => {
              const isCurrent = rung.screen === screen;
              const state = isCurrent ? t.current : rung.done ? t.done : t.notYet;
              return (
                <li key={rung.screen}>
                  <a
                    href={rung.href}
                    aria-current={isCurrent ? 'step' : undefined}
                    data-rung={rung.screen}
                    data-done={rung.done ? 'true' : 'false'}
                    className={cx(
                      'flex items-center gap-md rounded-md px-md py-sm text-sm',
                      isCurrent ? 'bg-surface-strong font-semibold' : 'hover:bg-surface',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cx(
                        'flex size-xl shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                        rung.done ? 'border-positive bg-positive text-on-primary' : 'border-border text-text-muted',
                      )}
                    >
                      {rung.done ? '✓' : i + 1}
                    </span>
                    <span className="min-w-0 flex-1">{t.rungs[rung.screen]}</span>
                    <span className={cx('shrink-0 text-xs', rung.done ? 'text-positive' : 'text-text-muted')}>{state}</span>
                  </a>
                </li>
              );
            })}
          </ol>
        </nav>

        {ready && (
          <Stack gap="sm">
            <div data-testid="ladder-in10y">
              <Stat
                label={t.in10yLabel}
                value={formatMoney(in10y.mid)}
                size="lg"
                isEstimate={estimates.left > 0}
                hint={t.in10yHint}
              />
            </div>
            <p className="text-sm tabular-nums" data-testid="ladder-range">
              {t.range(formatMoney(in10y.low), formatMoney(in10y.high))}
            </p>
            <div className="flex flex-col gap-xs">
              <div className="flex items-baseline justify-between gap-md text-sm">
                <span id={narrowedId}>{t.narrowedLabel}</span>
                <span className="font-semibold tabular-nums">{formatRate(bandNarrowed, 0)}</span>
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
              <p className="text-xs text-text-muted">
                {t.estimatesLeft(estimates.left, estimates.total)} {t.bandNote}
              </p>
            </div>
          </Stack>
        )}

        <Row gap="sm">
          <a href={progress.futureHref} className={buttonClassName({ variant: 'primary', size: 'md' })}>
            {t.futureCta}
          </a>
          {next && (
            <a href={next.href} className={buttonClassName({ variant: 'secondary', size: 'md' })}>
              {t.next(screenTitles[next.screen])}
            </a>
          )}
        </Row>
      </Stack>
    </Card>
  );
}
