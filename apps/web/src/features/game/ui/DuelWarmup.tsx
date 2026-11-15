// One round of the daily duel as the onboarding's opening (/start), in a calmer layout than /play: a
// small header, two compact cards and nothing else while you pick (no hint: the warm-up is a first
// look, not a scored strategy). The reveal is the result, the headline, what decided it and one
// "Continue"; the side-by-side breakdown and its sources sit in a fold underneath. The same DuelVM as
// DuelScreen; the pick counts toward today's five on /play. A day already finished shows its score
// line and the same Continue.
'use client';

import { common, duel as t, welcome } from '@/copy';
import { Button, cx, formatMoney, formatRate } from '@/ui-kit';
import type { DuelVM } from '../model/types';
import { DuelCard } from './DuelCard';
import { DuelReveal } from './DuelReveal';
import { errorText } from './errorText';

export type DuelWarmupProps = {
  vm: DuelVM;
  onContinue: () => void;
  continueLabel: string;
  /** Eyebrow over the question ("Warm-up · 1 round"). */
  sticker: string;
  /** The fold under the reveal that opens the side-by-side breakdown and its sources. */
  moreLabel?: string;
};

export function DuelWarmup({ vm, onContinue, continueLabel, sticker, moreLabel = welcome.warmup.more }: DuelWarmupProps) {
  const ready = vm.status === 'ready';
  const roundPhase = ready && vm.phase === 'round';
  const reveal = ready && vm.phase === 'reveal' ? vm.reveal : null;
  const picking = vm.cards?.some((c) => c.state === 'picked') ?? false;
  return (
    <section data-testid="duel-warmup" className="mx-auto flex w-full max-w-(--container-4xl) flex-col gap-xl">
      <header className={cx('flex flex-col items-center gap-sm text-center', reveal && 'sr-only')}>
        <p className="inline-flex items-center gap-sm text-xs font-bold uppercase tracking-wide text-text-muted">
          <span aria-hidden="true" className="size-sm rounded-full bg-primary" />
          {sticker}
        </p>
        <h1 className={cx('font-display text-3xl font-extrabold leading-tight tracking-tight text-balance sm:text-5xl', !roundPhase && ready && 'sr-only')}>
          {t.title}
        </h1>
        {roundPhase && <p className="text-sm text-text-muted sm:text-base">{t.subtitle}</p>}
      </header>

      {vm.status === 'loading' && (
        <div role="status" aria-busy="true" className="grid grid-cols-1 gap-lg md:grid-cols-2">
          <span className="sr-only">{t.loading}</span>
          {[0, 1].map((i) => <div key={i} aria-hidden="true" className="h-[calc(var(--spacing-3xl)*6)] animate-pulse rounded-xl bg-surface-strong" />)}
        </div>
      )}
      {vm.status === 'error' && (
        <div className="flex flex-col items-center gap-md text-center">
          <p className="text-text-muted">{vm.error ? errorText(vm.error) : ''}</p>
          <Button onClick={onContinue}>{continueLabel}</Button>
        </div>
      )}

      {reveal && (
        <div className="flex flex-col items-center gap-sm text-center">
          <p role="status">
            <span
              className={cx(
                'inline-flex items-center rounded-full px-md py-xs text-xs font-bold uppercase tracking-wide',
                reveal.correct ? 'bg-positive text-on-primary' : 'bg-surface-strong text-text',
              )}
            >
              {reveal.correct ? t.reveal.right(reveal.points.toLocaleString('en-US')) : t.reveal.wrong}
            </span>
          </p>
          <h2 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-balance sm:text-5xl">
            {reveal.costlier ? t.reveal.headline(reveal.costlier, formatMoney(reveal.difference)) : t.reveal.same}
          </h2>
          <p className="max-w-(--container-xl) text-sm text-text-muted text-balance sm:text-base">
            {t.reveal.decidedLine(
              common.categories[reveal.decidedBy.category],
              formatMoney(reveal.decidedBy.amount),
              formatMoney(reveal.decidedBy.otherAmount),
            )}
            . {reveal.lesson}
          </p>
        </div>
      )}

      {ready && vm.phase !== 'summary' && vm.cards && (
        <div className="relative grid w-full grid-cols-1 items-stretch gap-md md:grid-cols-2 md:gap-xl">
          <DuelCard variant="compact" card={vm.cards[0]} onPick={roundPhase ? () => vm.pick(vm.cards![0].letter) : undefined} disabled={picking} />
          {/* A quiet "or" between the lives, centered on the gap. Decorative: the cards carry the meaning. */}
          <span
            aria-hidden="true"
            className="pointer-events-none z-20 -my-lg flex size-2xl items-center justify-center justify-self-center rounded-full bg-bg text-xs font-bold text-text-muted ring-1 ring-border md:absolute md:left-1/2 md:top-1/2 md:my-0 md:-translate-x-1/2 md:-translate-y-1/2"
          >
            {t.vs}
          </span>
          <DuelCard variant="compact" card={vm.cards[1]} onPick={roundPhase ? () => vm.pick(vm.cards![1].letter) : undefined} disabled={picking} />
        </div>
      )}

      {roundPhase && vm.pickError && (
        <p role="alert" className="text-center text-sm font-semibold">{t.pickError} {errorText(vm.pickError)}</p>
      )}

      {/* On a phone the button sticks to the bottom edge, in reach under the two stacked cards (a direct
          child of the section, so it sticks for the section's whole height). */}
      {reveal && (
        <div className="sticky bottom-lg z-30 -mb-md flex justify-center sm:static">
          <Button size="lg" onClick={onContinue} className="w-full shadow-lg sm:w-auto sm:shadow-none">{continueLabel}</Button>
        </div>
      )}
      {reveal && (
        <p className="-mt-sm text-center text-xs text-text-muted">
          {reveal.crowd
            ? t.reveal.crowd(formatRate(reveal.crowd.share, 0), reveal.crowd.letter, reveal.crowd.total.toLocaleString('en-US'))
            : t.reveal.crowdNone}
        </p>
      )}

      {reveal && (
        <details className="group w-full text-center">
          <summary className="cursor-pointer text-sm font-semibold text-text-muted hover:text-text">{moreLabel}</summary>
          <div className="mt-lg">
            <DuelReveal reveal={reveal} />
          </div>
        </details>
      )}

      {ready && vm.phase === 'summary' && (
        <div className="flex flex-col items-center gap-md text-center">
          <p className="text-lg text-text-muted">{t.summary.heading}</p>
          <Button size="lg" onClick={onContinue}>{continueLabel}</Button>
        </div>
      )}
    </section>
  );
}
