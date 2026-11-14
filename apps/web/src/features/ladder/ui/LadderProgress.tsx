// Ladder progress, Design v3. LadderSteps: one row of numbered step pills (this step = ink, done =
// soft green with ✓, skipped / not yet = white; the state is read out to screen readers). The step
// you are on never shows ✓ (JF16: honest states).
import { ladder } from '@/copy';
import { cx } from '@/ui-kit';
import type { LadderProgressVM, LadderScreen } from '../model/types';

const t = ladder.shell;

export type LadderProgressProps = { screen: LadderScreen; progress: LadderProgressVM };

export function LadderSteps({ screen, progress }: LadderProgressProps) {
  const { rungs, doneCount } = progress;
  const ready = progress.status === 'ready';
  const current = screen === 'S7' ? 'S9' : screen;
  const currentIndex = rungs.findIndex((r) => r.screen === current);
  return (
    <nav aria-label={t.stepsLabel} className="min-w-0">
      <p className="sr-only">{ready ? t.stepsDone(doneCount, rungs.length) : t.loading}</p>
      <ol className="flex flex-wrap gap-sm">
        {rungs.map((rung, i) => {
          const isCurrent = rung.screen === current;
          const state = isCurrent ? t.current : rung.done ? t.done : i < currentIndex ? t.skipped : t.notYet;
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
                {rung.done && !isCurrent && <span aria-hidden="true">✓</span>}
                <span className="sr-only">({state})</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
