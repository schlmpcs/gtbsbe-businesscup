import { useId } from 'react';
import { duel as t } from '@/copy';
import { Art, Money, Sticker, cx, type ArtName } from '@/ui-kit';
import type { DuelCardVM, DuelFactGroup, DuelFactGroupId } from '../model/types';
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
 * The house picture, from facts the card already shows (bedrooms in the layout id, kids in the Family
 * group), never from the cost: a studio or one-bedroom is an apartment, a big home is the large house,
 * a small home with kids is the family house, the rest the suburban house.
 */
function homeArt(card: DuelCardVM): ArtName {
  const match = /(\d)bed/.exec(card.art);
  const bedrooms = match ? Number(match[1]) : 0;
  const kids = card.facts.find((g) => g.group === 'family')?.items[0] !== t.facts.noKids;
  if (bedrooms <= 1) return 'home-apartment';
  if (bedrooms >= 4) return 'home-large';
  if (kids && bedrooms <= 2) return 'home-family';
  return 'home-suburb';
}

const GROUP_ICON: Record<DuelFactGroupId, DuelIconName> = { home: 'home', family: 'people', car: 'car', food: 'food' };

/** One fact group tile: icon and group name, then its two lines (the first one bold). */
function FactGroup({ group }: { group: DuelFactGroup }) {
  const [main, detail] = group.items;
  return (
    <li className="flex min-w-0 flex-col gap-xs rounded-lg bg-surface-strong p-md">
      <span className="inline-flex items-center gap-xs text-xs font-bold uppercase tracking-wide text-text-muted">
        <DuelIcon name={GROUP_ICON[group.group]} className="size-md shrink-0 text-primary" />
        {t.facts.groups[group.group]}
      </span>
      <span className="text-sm font-bold leading-snug text-text sm:text-base">{main}</span>
      <span className="text-sm leading-snug text-text-muted">{detail}</span>
    </li>
  );
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
        // On desktop the two cards share the screen's grid rows (subgrid), so the house, title, facts,
        // quote and total line up across A and B whatever each one's text wraps to.
        'relative flex h-full w-full min-w-0 flex-col gap-lg rounded-xl bg-surface p-lg text-text shadow-md transition sm:p-xl md:grid md:grid-rows-subgrid',
        revealed ? 'md:row-span-6' : 'md:row-span-5',
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
        <p className="inline-flex items-center gap-xs text-base text-text-muted">
          <DuelIcon name="pin" className="size-md shrink-0" />
          {card.metro}
        </p>
      </div>

      <div className="flex min-w-0 flex-col gap-sm">
        <ul aria-label={t.card.factsLabel} className="grid grid-cols-2 gap-sm text-left">
          {card.facts.map((g) => (
            <FactGroup key={g.group} group={g} />
          ))}
          {card.hintFact && (
            <li className="col-span-2 flex items-center gap-sm rounded-lg bg-primary-soft p-md text-primary">
              <DuelIcon name="pin" className="size-lg shrink-0" />
              <span className="flex min-w-0 flex-col">
                <span className="text-xs font-bold uppercase tracking-wide">
                  {t.card.hintFact} · {t.card.hintGroup}
                </span>
                <span className="text-sm font-bold sm:text-base">{card.hintFact}</span>
              </span>
            </li>
          )}
        </ul>
      </div>

      <blockquote className="border-l-4 border-primary-soft pl-md text-left text-sm italic text-text-muted">
        {card.caption ? t.card.quote(card.caption) : null}
      </blockquote>

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
