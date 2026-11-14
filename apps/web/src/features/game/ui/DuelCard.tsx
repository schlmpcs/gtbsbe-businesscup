import { useId } from 'react';
import { duel as t } from '@/copy';
import { Art, Money, Sticker, cx, type ArtName } from '@/ui-kit';
import type { DuelCardVM } from '../model/types';
import { CategoryBar } from './CategoryBar';
import { DuelIcon, type DuelIconName } from './DuelIcons';

export type DuelCardProps = {
  card: DuelCardVM;
  /** Tap = pick this life. Absent after the reveal (the card is no longer a button). */
  onPick?: () => void;
  /** Another pick is on its way: both cards stop taking taps. */
  disabled?: boolean;
};

const FRAME: Record<DuelCardVM['state'], string> = {
  round: '',
  picked: 'ring-4 ring-inset ring-primary animate-pulse',
  winner: 'ring-4 ring-inset ring-primary',
  other: '',
};

/**
 * The house picture, from facts the card already shows (bedrooms in the layout id, kids in the fact
 * chips), never from the cost: a studio or one-bedroom is an apartment, a big home is the large house,
 * a small home with kids is the family house, the rest the suburban house.
 */
function homeArt(card: DuelCardVM): ArtName {
  const match = /(\d)bed/.exec(card.art);
  const bedrooms = match ? Number(match[1]) : 0;
  const kids = !card.facts.includes(t.facts.noKids);
  if (bedrooms <= 1) return 'home-apartment';
  if (bedrooms >= 4) return 'home-large';
  if (kids && bedrooms <= 2) return 'home-family';
  return 'home-suburb';
}

const CAR_FACTS: readonly string[] = [t.facts.noCar, t.facts.economyCar, t.facts.midCar, t.facts.luxuryCar];
const KID_FACTS: readonly string[] = [t.facts.daycare, t.facts.schoolKids, t.facts.noKids];
const FOOD_FACTS: readonly string[] = [t.facts.cooksAtHome, t.facts.eatsOutSometimes, t.facts.eatsOutOften, t.facts.eatsOutMostDays];

function factIcon(fact: string): DuelIconName {
  if (CAR_FACTS.includes(fact)) return 'car';
  if (KID_FACTS.includes(fact)) return 'people';
  if (FOOD_FACTS.includes(fact)) return 'food';
  return 'home';
}

/**
 * One life in a duel (Figma Design v3 DuelCard). States: Round (tap to pick), Picked (pick on its
 * way), Winner (the costlier life, after the reveal: orange ring, big orange total) and Other. The
 * revealed total and bars come from the view-model; this only lays them out.
 */
export function DuelCard({ card, onPick, disabled = false }: DuelCardProps) {
  const headingId = useId();
  const revealed = card.state === 'winner' || card.state === 'other';
  const pickable = Boolean(onPick) && !revealed;

  return (
    <article
      aria-labelledby={headingId}
      className={cx(
        'relative flex h-full w-full min-w-0 flex-col gap-lg rounded-xl bg-surface p-lg text-text shadow-md transition sm:p-xl',
        FRAME[card.state],
        pickable && 'hover:-translate-y-xs hover:shadow-lg has-[button:focus-visible]:ring-4 has-[button:focus-visible]:ring-inset has-[button:focus-visible]:ring-primary',
      )}
    >
      <div className="flex items-start justify-between gap-sm">
        <span className="flex size-3xl shrink-0 items-center justify-center rounded-full bg-ink font-display text-2xl font-extrabold text-on-primary">
          {card.letter}
        </span>
        {revealed ? (
          <div className="flex flex-wrap justify-end gap-xs">
            {card.pickedByYou && (
              <Sticker tone="ink">
                {t.card.yourPick}
              </Sticker>
            )}
            {card.state === 'winner' && (
              <Sticker tone="primary">
                {t.card.costsMore}
              </Sticker>
            )}
          </div>
        ) : (
          <span title={t.card.compositeHint} className="rounded-full bg-surface-strong px-md py-xs text-xs font-semibold text-text-muted">
            {t.card.composite}
          </span>
        )}
      </div>

      <Art
        name={homeArt(card)}
        // object-contain inside a capped box: every house gets the same height, so the titles line up.
        imgClassName={
          revealed
            ? 'max-h-[calc(var(--spacing-3xl)*4)] sm:max-h-[calc(var(--spacing-3xl)*5)]'
            : 'max-h-[calc(var(--spacing-3xl)*5)] sm:max-h-[calc(var(--spacing-3xl)*8)]'
        }
      />

      <div className="flex min-w-0 flex-col gap-xs text-left">
        <h3
          id={headingId}
          className="font-display text-2xl font-extrabold leading-tight break-words sm:text-[length:calc(var(--text-4xl)*0.95)]"
        >
          {card.household}
        </h3>
        <p className="text-base text-text-muted">{card.metro}</p>
        <p className="text-sm text-text-muted">{card.caption}</p>
      </div>

      <ul aria-label={t.card.factsLabel} className="flex flex-wrap gap-sm">
        {card.facts.map((f) => (
          <li key={f} className="inline-flex items-center gap-sm rounded-full bg-surface-strong px-md py-sm text-sm font-semibold text-text">
            <DuelIcon name={factIcon(f)} />
            {f}
          </li>
        ))}
        {card.hintFact && (
          <li className="inline-flex items-center gap-sm rounded-full bg-primary-soft px-md py-sm text-sm font-bold text-primary">
            <DuelIcon name="pin" />
            <span className="sr-only">{t.card.hintFact}: </span>
            {card.hintFact}
          </li>
        )}
      </ul>

      {revealed && card.total !== null && (
        <div className="mt-auto flex flex-col gap-md border-t border-border pt-lg">
          <p className="flex flex-wrap items-baseline gap-sm">
            <Money
              value={card.total}
              className={cx(
                'font-display text-display font-extrabold leading-display tracking-tight',
                card.state === 'winner' ? 'text-primary' : 'text-text',
              )}
            />
            <span className="text-xl text-text-muted">{t.reveal.perMonth}</span>
          </p>
          <CategoryBar label={t.reveal.breakdownLabel(card.letter)} categories={card.categories} />
        </div>
      )}

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
