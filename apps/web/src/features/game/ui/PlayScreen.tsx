import { useEffect, useRef, type ComponentType } from 'react';
import { game as t, screenTitles } from '@/copy';
import { Button, Card, cx } from '@/ui-kit';
import type { PlayVM } from '../model/types';
import { ClueBoard, type ClueBoardProps } from './ClueBoard';
import { Countdown } from './Countdown';
import { errorText } from './errorText';
import { GuessPanel } from './GuessPanel';
import { HomeCard } from './HomeCard';
import { RevealView } from './RevealView';
import { SummaryView } from './SummaryView';

export type PlayScreenProps = {
  vm: PlayVM;
  /** S5 route for the "guess your own life" bridge. */
  guessOwnHref: string;
  /**
   * The clue panel. Default: the static ClueBoard (tap-to-reveal rows). The illustrated
   * <HouseScene> (T12) takes the same props and goes here once its flag is on.
   */
  ClueSlot?: ComponentType<ClueBoardProps>;
};

function LoadingState() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-lg">
      <span className="sr-only">{t.loading}</span>
      <div aria-hidden="true" className="h-3xl w-full animate-pulse rounded-lg bg-surface-strong" />
      <div aria-hidden="true" className="flex flex-col gap-sm">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-2xl w-full animate-pulse rounded-md bg-surface" />
        ))}
      </div>
      <div aria-hidden="true" className="h-3xl w-full animate-pulse rounded-lg bg-surface-strong" />
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

  return (
    <main
      className={cx(
        'mx-auto flex w-full flex-col gap-lg px-lg py-xl',
        large ? 'max-w-(--container-6xl) text-lg' : 'max-w-(--container-2xl)',
      )}
    >
      <header className="flex flex-col gap-xs">
        <h1 className={cx('leading-display', large ? 'text-display' : 'text-4xl')}>
          {screenTitles[screen]}
        </h1>
        {showProgress && (
          <p className={cx('font-medium text-text-muted', large ? 'text-2xl' : 'text-base')}>
            {t.progress(vm.progress.index + 1, vm.progress.total)}
          </p>
        )}
      </header>

      <div ref={contentRef} tabIndex={-1} className="flex flex-col gap-lg focus:outline-none">
        {vm.status === 'loading' && <LoadingState />}

        {vm.status === 'error' && (
          <Card title={t.errors.title}>
            <p className="mb-md text-text-muted">{vm.error ? errorText(vm.error) : t.errors.byKind.unknown}</p>
            <Button onClick={vm.retry}>{t.errors.retry}</Button>
          </Card>
        )}

        {vm.status === 'ready' && vm.phase === 'explore' && vm.card && (
          <div className={cx('grid grid-cols-1 gap-lg', large && 'lg:grid-cols-2')}>
            <div className="flex flex-col gap-lg">
              <HomeCard card={vm.card} large={large} />
              <ClueSlot card={vm.card} onOpenClue={vm.openClue} disabled={vm.card.submitting} large={large} />
            </div>
            <div className="flex flex-col gap-lg">
              {streamer && <Countdown streamer={streamer} />}
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
        )}

        {vm.status === 'ready' && vm.phase === 'reveal' && vm.reveal && (
          <RevealView reveal={vm.reveal} onNext={vm.next} large={large} />
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
    </main>
  );
}
