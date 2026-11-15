// One round of the daily duel as the onboarding's opening (/start): the round on screen, its two lives,
// the hint, and the reveal with "Continue" instead of "Next round". The same DuelVM and pieces as
// DuelScreen; the pick counts toward today's five on /play. A day already finished shows its score line
// and the same Continue.
'use client';

import { duel as t } from '@/copy';
import { Button, cx, formatRate } from '@/ui-kit';
import type { DuelVM } from '../model/types';
import { DuelCard } from './DuelCard';
import { DuelReveal, DuelRevealBand, DuelRevealHeader } from './DuelReveal';
import { errorText } from './errorText';
import { VSBadge } from './VSBadge';

export type DuelWarmupProps = {
  vm: DuelVM;
  onContinue: () => void;
  continueLabel: string;
  /** Sticker over the question ("Warm-up · 1 round"). */
  sticker: string;
};

export function DuelWarmup({ vm, onContinue, continueLabel, sticker }: DuelWarmupProps) {
  const ready = vm.status === 'ready';
  const roundPhase = ready && vm.phase === 'round';
  const reveal = ready && vm.phase === 'reveal' ? vm.reveal : null;
  const picking = vm.cards?.some((c) => c.state === 'picked') ?? false;
  return (
    <section data-testid="duel-warmup" className="flex w-full flex-col gap-xl">
      <header className="flex flex-col items-center gap-md text-center">
        <span className="rounded-full bg-ink px-lg py-sm text-sm font-bold uppercase tracking-wide text-on-primary shadow-md">{sticker}</span>
        <h1 className={cx('font-display text-4xl font-extrabold leading-display tracking-tight text-balance sm:text-6xl', !roundPhase && ready && 'sr-only')}>
          {t.title}
        </h1>
        {roundPhase && <p className="text-base text-text-muted sm:text-lg">{t.subtitle}</p>}
      </header>

      {vm.status === 'loading' && (
        <div role="status" aria-busy="true" className="grid grid-cols-1 gap-xl md:grid-cols-2">
          <span className="sr-only">{t.loading}</span>
          {[0, 1].map((i) => <div key={i} aria-hidden="true" className="h-96 animate-pulse rounded-xl bg-surface-strong" />)}
        </div>
      )}
      {vm.status === 'error' && (
        <div className="flex flex-col items-center gap-md text-center">
          <p className="text-text-muted">{vm.error ? errorText(vm.error) : ''}</p>
          <Button onClick={onContinue}>{continueLabel}</Button>
        </div>
      )}

      {reveal && <DuelRevealHeader reveal={reveal} totalRounds={vm.totalRounds} />}
      {reveal && <DuelRevealBand reveal={reveal} onNext={onContinue} nextLabel={continueLabel} />}

      {ready && vm.phase !== 'summary' && vm.cards && (
        <div className="relative mx-auto grid w-full grid-cols-1 items-stretch md:grid-cols-2 md:gap-2xl">
          <DuelCard card={vm.cards[0]} onPick={roundPhase ? () => vm.pick(vm.cards![0].letter) : undefined} disabled={picking} />
          <VSBadge className="pointer-events-none relative z-20 -my-lg justify-self-center md:absolute md:left-1/2 md:top-1/2 md:my-0 md:-translate-x-1/2 md:-translate-y-1/2" />
          <DuelCard card={vm.cards[1]} onPick={roundPhase ? () => vm.pick(vm.cards![1].letter) : undefined} disabled={picking} />
        </div>
      )}

      {roundPhase && vm.hint && !vm.hint.used && (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={vm.openHint} disabled={vm.hint.status === 'opening'}>
            {vm.hint.status === 'opening' ? t.hint.opening : t.hint.offer(formatRate(vm.hint.cost, 0))}
          </Button>
        </div>
      )}
      {roundPhase && vm.pickError && (
        <p role="alert" className="text-center text-sm font-semibold">{t.pickError} {errorText(vm.pickError)}</p>
      )}

      {reveal && <DuelReveal reveal={reveal} />}

      {ready && vm.phase === 'summary' && (
        <div className="flex flex-col items-center gap-md text-center">
          <p className="text-lg text-text-muted">{t.summary.heading}</p>
          <Button size="lg" onClick={onContinue}>{continueLabel}</Button>
        </div>
      )}
    </section>
  );
}
