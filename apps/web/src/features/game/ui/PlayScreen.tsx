import { useEffect, useRef, type ComponentType } from 'react';
import { game as t, screenTitles } from '@/copy';
import { Button, Card, Scoreboard, Sticker, cx, formatRate } from '@/ui-kit';
import type { PlayVM } from '../model/types';
import { ClueBoard, type ClueBoardProps } from './ClueBoard';
import { Countdown } from './Countdown';
import { errorText } from './errorText';
import { GuessPanel } from './GuessPanel';
import { HomeCard } from './HomeCard';
import { HomeStrip } from './HomeStrip';
import { RevealView } from './RevealView';
import { SummaryView } from './SummaryView';

export type PlayScreenProps = {
  vm: PlayVM;
  /** S5 route for the "guess your own life" bridge. */
  guessOwnHref: string;
  /**
   * The clue panel. Default: the static ClueBoard (tap-to-reveal rooms). The illustrated
   * <HouseScene> (T12) takes the same props and goes here once its flag is on.
   */
  ClueSlot?: ComponentType<ClueBoardProps>;
};

function LoadingState() {
  return (
    <div role="status" aria-busy="true" className="grid grid-cols-1 gap-2xl lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <span className="sr-only">{t.loading}</span>
      <div aria-hidden="true" className="h-[calc(var(--spacing-3xl)*8)] w-full animate-pulse rounded-xl bg-surface-strong" />
      <div aria-hidden="true" className="flex flex-col gap-lg">
        <div className="h-xl w-1/3 animate-pulse rounded-full bg-surface-strong" />
        <div className="h-3xl w-2/3 animate-pulse rounded-md bg-surface-strong" />
        <div className="h-3xl w-full animate-pulse rounded-md bg-surface" />
        <div className="h-3xl w-full animate-pulse rounded-lg bg-surface-strong" />
      </div>
    </div>
  );
}

/** /play: S2 explore + guess, S3 reveal and the day's summary, S4 streamer mode (`vm.streamer`). */
export function PlayScreen({ vm, guessOwnHref, ClueSlot = ClueBoard }: PlayScreenProps) {
  const streamer = vm.streamer;
  const large = streamer !== null;
  const screen = large ? 'S4' : vm.status === 'ready' && vm.phase !== 'explore' ? 'S3' : 'S2';

  // When the view changes (reveal, next home, summary), move focus and scroll to the new content,
  // so phone and keyboard users don't stay stranded at the button they just pressed.
  const contentRef = useRef<HTMLDivElement>(null);
  const viewKey = vm.status === 'ready' ? `${vm.phase}:${vm.card?.id ?? ''}` : null;
  const lastViewKey = useRef<string | null>(null);
  useEffect(() => {
    if (viewKey === null) return;
    if (lastViewKey.current !== null && lastViewKey.current !== viewKey) contentRef.current?.focus();
    lastViewKey.current = viewKey;
  }, [viewKey]);

  const showProgress = vm.status === 'ready' && vm.phase !== 'summary' && vm.progress.total > 0;
  const progressLabel = showProgress ? t.progress(vm.progress.index + 1, vm.progress.total) : null;

  return (
    // S4 turns the whole page into the orange arena; white tiles on it set their own text color.
    <main className={cx('w-full', large && 'min-h-dvh bg-primary text-on-primary')}>
      <div className="mx-auto flex w-full max-w-(--container-7xl) flex-col gap-xl px-lg py-xl">
        <header className="flex flex-wrap items-center justify-between gap-md">
          <div className="flex flex-wrap items-center gap-md">
            <h1
              className={cx(
                'font-display font-extrabold uppercase tracking-wide leading-tight',
                large ? 'text-2xl' : 'text-sm text-text-muted',
              )}
            >
              {screenTitles[screen]}
            </h1>
            {large && (
              <Sticker tone="ink" className="text-sm">
                <span aria-hidden="true" className="inline-block size-sm rounded-full bg-on-primary" />
                {t.streamer.live}
              </Sticker>
            )}
          </div>
          {showProgress && vm.day.homes.length > 0 && <HomeStrip day={vm.day} />}
        </header>

        <div ref={contentRef} tabIndex={-1} className="flex flex-col gap-xl focus:outline-none">
          {vm.status === 'loading' && <LoadingState />}

          {vm.status === 'error' && (
            <Card title={t.errors.title} className="text-text">
              <p className="mb-md text-text-muted">{vm.error ? errorText(vm.error) : t.errors.byKind.unknown}</p>
              <Button onClick={vm.retry}>{t.errors.retry}</Button>
            </Card>
          )}

          {vm.status === 'ready' && vm.phase === 'explore' && vm.card && (
            <>
              <div className="grid grid-cols-1 gap-2xl lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start">
                <ClueSlot card={vm.card} onOpenClue={vm.openClue} disabled={vm.card.submitting} large={large} />
                <div className="flex min-w-0 flex-col gap-xl">
                  {streamer && <Countdown streamer={streamer} />}
                  <HomeCard card={vm.card} progressLabel={progressLabel} large={large} />
                  <GuessPanel
                    guess={vm.card.guess}
                    onGuessChange={vm.setGuess}
                    onLockIn={streamer ? streamer.lockIn : vm.submitGuess}
                    submitting={vm.card.submitting}
                    error={vm.card.guessError}
                    large={large}
                  />
                </div>
              </div>
              <Scoreboard
                label={t.score.label}
                items={[
                  { id: 'max', value: vm.day.maxPerHome.toLocaleString('en-US'), label: t.score.maxPerHome },
                  {
                    id: 'multiplier',
                    value: formatRate(vm.card.multiplier),
                    label: t.score.multiplier(vm.card.openedCount),
                    tone: 'primary',
                  },
                  { id: 'total', value: vm.day.totalPoints.toLocaleString('en-US'), label: t.score.total },
                ]}
              />
            </>
          )}

          {vm.status === 'ready' && vm.phase === 'reveal' && vm.reveal && (
            <RevealView reveal={vm.reveal} onNext={vm.next} progressLabel={progressLabel} large={large} />
          )}

          {vm.status === 'ready' && vm.phase === 'summary' && vm.summary && (
            <SummaryView
              summary={vm.summary}
              shareStatus={vm.shareStatus}
              onShare={vm.share}
              guessOwnHref={guessOwnHref}
              large={large}
            />
          )}
        </div>
      </div>
    </main>
  );
}
