import { useEffect, useId, useRef } from 'react';
import { duel as t } from '@/copy';
import { Button, Card, cx, formatRate } from '@/ui-kit';
import type { DuelCardVM, DuelHintVM, DuelVM } from '../model/types';
import { DuelCard } from './DuelCard';
import { DuelIcon } from './DuelIcons';
import { DuelChallengeLine } from './DuelChallenge';
import { DuelReveal, DuelRevealBand, DuelRevealHeader } from './DuelReveal';
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
    <div role="status" aria-busy="true" className="grid grid-cols-1 gap-xl md:grid-cols-2 md:gap-2xl">
      <span className="sr-only">{t.loading}</span>
      {[0, 1].map((i) => (
        <div key={i} aria-hidden="true" className="h-[calc(var(--spacing-3xl)*10)] animate-pulse rounded-xl bg-surface-strong" />
      ))}
    </div>
  );
}

/** The larger pill of Design v3 (round, hint used): the ui-kit Sticker's look at a bigger size. */
const BIG_STICKER = 'rounded-full px-lg py-sm text-sm font-bold uppercase tracking-wide shadow-md sm:text-base';

const fmt = (n: number) => n.toLocaleString('en-US');

/**
 * Below the cards: the hint as a secondary button, what it opens (the neighborhood price level, one
 * more fact on each card) and what a right pick scores now; once used, an orange sticker.
 */
function HintRow({ hint, onOpen }: { hint: DuelHintVM; onOpen: () => void }) {
  const explainId = useId();
  if (hint.used) {
    return (
      <p role="status">
        <span className={cx(BIG_STICKER, 'inline-block -rotate-3 bg-primary text-on-primary')}>{t.hint.used(fmt(hint.pointsNow))}</span>
      </p>
    );
  }
  return (
    <div className="flex w-full max-w-(--container-xl) flex-col items-center gap-sm text-center">
      <Button
        variant="secondary"
        size="lg"
        onClick={onOpen}
        disabled={hint.status === 'opening'}
        aria-describedby={explainId}
        className="inline-flex w-full items-center justify-center gap-sm bg-surface disabled:cursor-wait disabled:opacity-60 sm:w-auto"
      >
        <DuelIcon name="bulb" className="size-lg shrink-0 text-primary" />
        {hint.status === 'opening' ? t.hint.opening : hint.status === 'error' ? t.hint.error : t.hint.offer(formatRate(hint.cost, 0))}
      </Button>
      <p id={explainId} className="text-sm text-text-muted">{t.hint.explain}</p>
      <p className="text-sm font-medium text-text-muted">{t.hint.worth(fmt(hint.pointsNow))}</p>
    </div>
  );
}

/** The duel: S2 Duel round, S3 Reveal and S3 Day result ("Which life costs more?"), Figma Design v3. */
export function DuelScreen({ vm, guessOwnHref }: DuelScreenProps) {
  // When the view changes (reveal, next round, day result), move focus to the new content and bring
  // the top of the screen into view (the result sticker and the next-round button sit there).
  const mainRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const viewKey = vm.status === 'ready' ? `${vm.phase}:${vm.round ?? ''}` : null;
  const lastViewKey = useRef<string | null>(null);
  useEffect(() => {
    if (viewKey === null) return;
    if (lastViewKey.current !== null && lastViewKey.current !== viewKey) {
      contentRef.current?.focus({ preventScroll: true });
      mainRef.current?.scrollIntoView?.({ block: 'start' });
    }
    lastViewKey.current = viewKey;
  }, [viewKey]);

  const ready = vm.status === 'ready';
  const picking = vm.cards?.some((c) => c.state === 'picked') ?? false;
  const inRound = ready && vm.phase !== 'summary' && vm.round !== null;
  const roundPhase = ready && vm.phase === 'round';
  const reveal = ready && vm.phase === 'reveal' ? vm.reveal : null;
  // The question is the page title; on the reveal and the day result it stays for screen readers only.
  const titleVisible = !ready || vm.phase === 'round';
  const renderCard = (card: DuelCardVM) => (
    <DuelCard key={card.letter} card={card} onPick={roundPhase ? () => vm.pick(card.letter) : undefined} disabled={picking} />
  );

  return (
    <main ref={mainRef} className="w-full">
      <div className="mx-auto flex w-full max-w-(--container-6xl) flex-col gap-xl px-lg py-xl sm:gap-2xl sm:py-2xl">
        <header className="flex flex-col items-center gap-lg text-center">
          {inRound && <RoundDots dots={vm.dots} />}
          {roundPhase && vm.round !== null && (
            <span className={cx(BIG_STICKER, 'bg-ink text-on-primary')}>
              {vm.hint ? t.roundSticker(vm.round, vm.totalRounds, fmt(vm.hint.pointsNow)) : t.round(vm.round, vm.totalRounds)}
            </span>
          )}
          <h1
            className={cx(
              titleVisible
                ? 'font-display text-4xl font-extrabold leading-display tracking-tight text-balance sm:text-display lg:text-[length:calc(var(--text-display)*1.35)]'
                : 'sr-only',
            )}
          >
            {t.title}
          </h1>
          {roundPhase && <p className="text-base text-text-muted sm:text-lg">{t.subtitle}</p>}
          {vm.challenged && ready && vm.phase !== 'summary' && <DuelChallengeLine challenge={vm.challenge} />}
          {vm.newDay && (
            <p role="status" className="rounded-full bg-primary-soft px-lg py-xs text-sm font-semibold text-primary">{t.newDay}</p>
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

          {reveal && <DuelRevealHeader reveal={reveal} totalRounds={vm.totalRounds} />}
          {reveal && <DuelRevealBand reveal={reveal} onNext={vm.next} />}

          {ready && vm.phase !== 'summary' && vm.cards && (
            <div className="relative mx-auto grid w-full max-w-(--container-6xl) grid-cols-1 items-stretch md:grid-cols-2 md:gap-x-2xl lg:gap-x-[calc(var(--spacing-3xl)*1.25)]">
              {renderCard(vm.cards[0])}
              <VSBadge className="pointer-events-none relative z-20 -my-lg justify-self-center md:absolute md:left-1/2 md:top-1/2 md:my-0 md:-translate-x-1/2 md:-translate-y-1/2" />
              {renderCard(vm.cards[1])}
            </div>
          )}

          {roundPhase && (
            <div className="flex flex-col items-center gap-sm">
              {vm.pickError && (
                <p role="alert" className="text-sm font-semibold text-text">
                  {t.pickError} {errorText(vm.pickError)}
                </p>
              )}
              {vm.hint && <HintRow hint={vm.hint} onOpen={vm.openHint} />}
            </div>
          )}

          {reveal && <DuelReveal reveal={reveal} />}

          {ready && vm.phase === 'summary' && vm.summary && (
            <DuelSummary
              summary={vm.summary}
              copyStatus={vm.copyStatus}
              shareStatus={vm.shareStatus}
              onCopyChallenge={vm.copyChallenge}
              onShare={vm.share}
              onGuessOwn={vm.guessOwn}
              guessOwnHref={guessOwnHref}
              challenge={vm.challenge.status === 'ready' && vm.challenge.data?.kind === 'friend' ? vm.challenge.data : null}
            />
          )}
        </div>

        <footer data-testid="duel-footer" className="text-center text-xs text-text-muted">
          <p>
            {t.footer.composite}
            {vm.source === 'fixtures' && ` ${t.footer.browser}`}
          </p>
        </footer>
      </div>
    </main>
  );
}
