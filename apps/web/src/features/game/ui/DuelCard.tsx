import { useId } from 'react';
import { duel as t } from '@/copy';
import { Money, SpriteImage, Sticker, cx } from '@/ui-kit';
import type { DuelCardVM } from '../model/types';
import { CategoryBar } from './CategoryBar';

export type DuelCardProps = {
  card: DuelCardVM;
  /** Tap = pick this life. Absent after the reveal (the card is no longer a button). */
  onPick?: () => void;
  /** Another pick is on its way: both cards stop taking taps. */
  disabled?: boolean;
};

const FRAME: Record<DuelCardVM['state'], string> = {
  round: 'border-transparent',
  picked: 'border-primary animate-pulse',
  winner: 'border-primary',
  other: 'border-transparent opacity-90',
};

/**
 * One life in a duel. States (Figma DuelCard): Round (tap to pick), Picked (pick on its way),
 * Winner (the costlier life, after the reveal) and Other. The revealed total and bars come from
 * the view-model; this only lays them out.
 */
export function DuelCard({ card, onPick, disabled = false }: DuelCardProps) {
  const headingId = useId();
  const revealed = card.state === 'winner' || card.state === 'other';

  const body = (
    <>
      <div className="flex items-center justify-between gap-sm">
        <span className="flex size-2xl items-center justify-center rounded-full bg-ink font-display text-lg font-extrabold text-on-primary">
          {card.letter}
        </span>
        <span title={t.card.compositeHint} className="rounded-full bg-surface-strong px-sm py-xs text-xs font-semibold text-text-muted">
          {t.card.composite}
        </span>
      </div>

      <div className="relative overflow-hidden rounded-lg bg-primary-soft">
        <SpriteImage id={card.art} className="mx-auto max-h-[calc(var(--spacing-3xl)*3)] w-auto object-contain p-sm" />
        {revealed && (
          <div className="absolute left-sm top-sm flex flex-wrap gap-xs">
            {card.state === 'winner' && (
              <Sticker tone="primary" tilt={-4}>
                {t.card.costsMore}
              </Sticker>
            )}
            {card.pickedByYou && (
              <Sticker tone="ink" tilt={3}>
                {t.card.yourPick}
              </Sticker>
            )}
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-xs text-left">
        <h3 id={headingId} className="font-display text-xl font-extrabold leading-tight break-words sm:text-2xl">
          {card.metro}
        </h3>
        <p className="text-sm font-semibold text-text">{card.household}</p>
        <p className="text-sm text-text-muted">{card.caption}</p>
      </div>

      <ul aria-label={t.card.factsLabel} className="flex flex-wrap gap-xs">
        {card.facts.map((f) => (
          <li key={f} className="rounded-full border border-border bg-bg px-sm py-xs text-xs font-semibold text-text">
            {f}
          </li>
        ))}
        {card.hintFact && (
          <li className="rounded-full bg-primary-soft px-sm py-xs text-xs font-bold text-primary">
            <span className="sr-only">{t.card.hintFact}: </span>
            {card.hintFact}
          </li>
        )}
      </ul>

      {revealed && card.total !== null && (
        <div className="flex flex-col gap-sm border-t border-border pt-md">
          <p className="flex items-baseline gap-xs">
            <Money value={card.total} className="font-display text-3xl font-extrabold leading-tight" />
            <span className="text-sm text-text-muted">{t.card.perMonth}</span>
          </p>
          <CategoryBar label={t.reveal.breakdownLabel(card.letter)} categories={card.categories} />
        </div>
      )}
    </>
  );

  const pickable = Boolean(onPick) && !revealed;
  return (
    <article
      aria-labelledby={headingId}
      className={cx(
        'relative flex h-full w-full min-w-0 flex-col gap-md rounded-xl border-4 bg-surface p-md text-text shadow-md transition sm:p-lg',
        FRAME[card.state],
        pickable && 'has-[button:focus-visible]:border-primary has-[button:hover]:border-primary',
      )}
    >
      {body}
      {pickable && (
        // The whole card is the tap target; the content above stays readable for screen readers.
        <button
          type="button"
          onClick={onPick}
          disabled={disabled}
          aria-label={t.card.pick(card.letter, card.metro)}
          aria-busy={card.state === 'picked'}
          className="absolute inset-0 z-10 cursor-pointer rounded-xl focus:outline-none disabled:cursor-wait"
        />
      )}
    </article>
  );
}
