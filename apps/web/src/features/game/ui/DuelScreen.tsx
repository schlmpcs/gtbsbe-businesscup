import { useEffect, useRef } from 'react';
import { duel as t } from '@/copy';
import { Button, Card, Sticker, formatRate } from '@/ui-kit';
import type { DuelHintVM, DuelVM } from '../model/types';
import { DuelCard } from './DuelCard';
import { DuelReveal, DuelRevealHeader } from './DuelReveal';
import { DuelSummary } from './DuelSummary';
import { errorText } from './errorText';
import { RoundDots } from './RoundDots';
import { VSBadge } from './VSBadge';

export type DuelScreenProps = {
  vm: DuelVM;
  /** S5 route for "Price my own month →". */
  guessOwnHref: string;
};

function LoadingState() {
  return (
    <div role="status" aria-busy="true" className="grid grid-cols-2 gap-md sm:gap-xl">
      <span className="sr-only">{t.loading}</span>
      {[0, 1].map((i) => (
        <div key={i} aria-hidden="true" className="h-[calc(var(--spacing-3xl)*8)] animate-pulse rounded-xl bg-surface-strong" />
      ))}
    </div>
  );
}

function HintPill({ hint, onOpen }: { hint: DuelHintVM; onOpen: () => void }) {
  const fmt = (n: number) => n.toLocaleString('en-US');
  if (hint.used) {
    return (
      <p role="status" className="rounded-full bg-primary-soft px-lg py-sm text-sm font-bold text-primary">
        {t.hint.used(fmt(hint.pointsNow))}
      </p>
    );
  }
  return (
    <Button
      variant="secondary"
      onClick={onOpen}
      disabled={hint.status === 'opening'}
      className="rounded-full border-border text-sm"
    >
      {hint.status === 'opening' ? t.hint.opening : hint.status === 'error' ? t.hint.error : t.hint.offer(formatRate(hint.cost, 0))}
    </Button>
  );
}

/** The duel: S2 Duel round, S3 Reveal and S3 Day result ("Which life costs more?"). */
export function DuelScreen({ vm, guessOwnHref }: DuelScreenProps) {
  // When the view changes (reveal, next round, day result), move focus to the new content.
  const contentRef = useRef<HTMLDivElement>(null);
  const viewKey = vm.status === 'ready' ? `${vm.phase}:${vm.round ?? ''}` : null;
  const lastViewKey = useRef<string | null>(null);
  useEffect(() => {
    if (viewKey === null) return;
    if (lastViewKey.current !== null && lastViewKey.current !== viewKey) contentRef.current?.focus();
    lastViewKey.current = viewKey;
  }, [viewKey]);

  const picking = vm.cards?.some((c) => c.state === 'picked') ?? false;
  const inRound = vm.status === 'ready' && vm.phase !== 'summary' && vm.round !== null;

  return (
    <main className="w-full">
      <div className="mx-auto flex w-full max-w-(--container-5xl) flex-col gap-xl px-lg py-xl">
        <header className="flex flex-col items-center gap-md text-center">
          <h1 className="font-display text-4xl font-extrabold leading-display sm:text-display">{t.title}</h1>
          {inRound && (
            <div className="flex flex-col items-center gap-sm">
              <Sticker tone="ink" className="text-sm">
                {t.round(vm.round!, vm.totalRounds)}
              </Sticker>
              <RoundDots dots={vm.dots} />
            </div>
          )}
          {vm.status === 'ready' && vm.phase === 'round' && <p className="text-base text-text-muted">{t.subtitle}</p>}
          {vm.challenged && vm.status === 'ready' && vm.phase !== 'summary' && (
            <p className="rounded-full bg-primary-soft px-lg py-xs text-sm font-semibold text-primary">{t.challenged}</p>
          )}
        </header>

        <div ref={contentRef} tabIndex={-1} className="flex flex-col gap-xl focus:outline-none">
          {vm.status === 'loading' && <LoadingState />}

          {vm.status === 'error' && (
            <Card title={t.errors.title} className="text-text">
              <p className="mb-md text-text-muted">{vm.error ? errorText(vm.error) : ''}</p>
              <Button onClick={vm.retry}>{t.errors.retry}</Button>
            </Card>
          )}

          {vm.status === 'ready' && vm.phase === 'reveal' && vm.reveal && <DuelRevealHeader reveal={vm.reveal} />}

          {vm.status === 'ready' && vm.phase === 'reveal' && vm.reveal && (
            <div className="flex justify-center">
              <Button size="lg" onClick={vm.next} className="w-full sm:w-auto sm:min-w-[calc(var(--spacing-3xl)*6)]">
                {vm.reveal.isLastRound ? t.reveal.finish : t.reveal.next}
              </Button>
            </div>
          )}

          {vm.status === 'ready' && vm.phase !== 'summary' && vm.cards && (
            <div className="relative grid grid-cols-2 items-stretch gap-md sm:gap-2xl">
              {vm.cards.map((card) => (
                <DuelCard
                  key={card.letter}
                  card={card}
                  onPick={vm.phase === 'round' ? () => vm.pick(card.letter) : undefined}
                  disabled={picking}
                />
              ))}
              <VSBadge className="pointer-events-none absolute left-1/2 top-[calc(var(--spacing-3xl)*2)] z-20 -translate-x-1/2" />
            </div>
          )}

          {vm.status === 'ready' && vm.phase === 'round' && (
            <div className="flex flex-col items-center gap-sm">
              {vm.pickError && (
                <p role="alert" className="text-sm font-semibold text-text">
                  {t.pickError} {errorText(vm.pickError)}
                </p>
              )}
              {vm.hint && <HintPill hint={vm.hint} onOpen={vm.openHint} />}
            </div>
          )}

          {vm.status === 'ready' && vm.phase === 'reveal' && vm.reveal && <DuelReveal reveal={vm.reveal} />}

          {vm.status === 'ready' && vm.phase === 'summary' && vm.summary && (
            <DuelSummary
              summary={vm.summary}
              copyStatus={vm.copyStatus}
              shareStatus={vm.shareStatus}
              onCopyChallenge={vm.copyChallenge}
              onShare={vm.share}
              guessOwnHref={guessOwnHref}
            />
          )}
        </div>
      </div>
    </main>
  );
}
