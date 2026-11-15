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

/** Each group's icon and accent (a chart token, so the tiles read apart at a glance). */
const GROUP: Record<DuelFactGroupId, { icon: DuelIconName; accent: string }> = {
  home: { icon: 'home', accent: 'text-chart-4 bg-[color-mix(in_srgb,var(--color-chart-4)_14%,transparent)]' },
  family: { icon: 'people', accent: 'text-chart-1 bg-[color-mix(in_srgb,var(--color-chart-1)_14%,transparent)]' },
  car: { icon: 'car', accent: 'text-chart-5 bg-[color-mix(in_srgb,var(--color-chart-5)_14%,transparent)]' },
  food: { icon: 'food', accent: 'text-text bg-[color-mix(in_srgb,var(--color-chart-3)_30%,transparent)]' },
};

const TILE = 'flex min-w-0 flex-col gap-xs rounded-lg px-md py-sm';
const CHIP = 'flex size-xl shrink-0 items-center justify-center rounded-full';
const CHIP_ICON = 'size-[calc(var(--spacing-md)*1.25)] shrink-0';
const LABEL = 'truncate text-xs font-semibold uppercase tracking-wide text-text-muted';

/** One fact group tile: icon chip and group name, then its two lines (the first one bold). */
function FactGroup({ group }: { group: DuelFactGroup }) {
  const [main, detail] = group.items;
  const { icon, accent } = GROUP[group.group];
  return (
    <li className={cx(TILE, 'bg-surface-strong')}>
      <span className="flex min-w-0 items-center gap-xs">
        <span className={cx(CHIP, accent)}>
          <DuelIcon name={icon} className={CHIP_ICON} />
        </span>
        <span className={LABEL}>{t.facts.groups[group.group]}</span>
      </span>
      <span className="flex min-w-0 flex-col leading-snug">
        <span className="text-sm font-bold text-text">{main}</span>
        {detail && <span className="text-xs text-text-muted">{detail}</span>}
      </span>
    </li>
  );
}

/** The neighborhood tile: the hint's fact once open (a list item), a dashed locked tile before. */
function HintTile({ fact }: { fact: string | null }) {
  const head = (locked: boolean) => (
    <span className="flex min-w-0 items-center gap-xs">
      <span className={cx(CHIP, locked ? 'bg-surface-strong text-text-muted' : 'bg-primary text-on-primary')}>
        <DuelIcon name={locked ? 'lock' : 'pin'} className={CHIP_ICON} />
      </span>
      <span className={LABEL}>
        {locked ? t.card.hintGroup : `${t.card.hintFact} · ${t.card.hintGroup}`}
      </span>
    </span>
  );
  if (fact === null) {
    // Not a fact yet, so not in the facts list: what the hint button opens, drawn in the grid.
    return (
      <div className={cx(TILE, 'col-span-2 border-2 border-dashed border-border')}>
        {head(true)}
        <span className="text-sm font-semibold leading-snug text-text-muted">{t.card.hintLocked}</span>
      </div>
    );
  }
  return (
    <li className={cx(TILE, 'col-span-2 bg-primary-soft')}>
      {head(false)}
      <span className="text-sm font-bold leading-snug text-primary">{fact}</span>
    </li>
  );
}

/**
 * One life in a duel, read like a mini profile (Figma Design v3 DuelCard, compact): a small house
 * thumbnail with the letter, the metro as the title, the household and the caption as a quote, then
 * the fact tiles (Home, Family, Car, Food and the neighborhood, locked until the hint), then "Pick A".
 * States: Round (tap to pick), Picked (pick on its way), Winner (the costlier life, after the reveal:
 * orange ring, big orange total) and Other. The revealed total and bars come from the view-model;
 * this only lays them out.
 */
export function DuelCard({ card, onPick, disabled = false }: DuelCardProps) {
  const headingId = useId();
  const revealed = card.state === 'winner' || card.state === 'other';
  const pickable = Boolean(onPick) && !revealed;

  return (
    <article
      aria-labelledby={headingId}
      className={cx(
        // On desktop the two cards share the screen's grid rows (subgrid), so the header, the tiles and
        // the foot (pick button or total) line up across A and B whatever each one's text wraps to.
        'group relative flex h-full w-full min-w-0 flex-col gap-lg rounded-xl bg-surface p-lg text-text shadow-md transition md:grid md:row-span-3 md:grid-rows-subgrid lg:p-xl',
        FRAME[card.state],
        pickable && 'hover:-translate-y-xs hover:shadow-lg has-[button:focus-visible]:ring-4 has-[button:focus-visible]:ring-inset has-[button:focus-visible]:ring-primary',
      )}
    >
      <div className="flex min-w-0 items-start gap-md sm:gap-lg">
        <div className="relative flex size-[calc(var(--spacing-3xl)*2.25)] shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--color-surface-strong)_70%,transparent)] p-xs sm:h-[calc(var(--spacing-3xl)*2.75)] sm:w-[calc(var(--spacing-3xl)*3.25)]">
          <Art name={homeArt(card)} loading="eager" className="size-full" imgClassName="h-full max-h-full object-contain" />
          <span className="absolute left-xs top-xs flex size-2xl items-center justify-center rounded-full bg-ink font-display text-lg font-extrabold text-on-primary shadow-md sm:size-[calc(var(--spacing-2xl)*1.25)] sm:text-xl">
            {card.letter}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-xs text-left">
          <div className="flex min-h-xl items-center justify-between gap-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-text-muted">{t.card.life(card.letter)}</p>
            {revealed ? (
              <div className="flex shrink-0 flex-wrap justify-end gap-xs">
                {card.pickedByYou && <Sticker tone="ink">{t.card.yourPick}</Sticker>}
                {card.state === 'winner' && <Sticker tone="primary">{t.card.costsMore}</Sticker>}
              </div>
            ) : (
              <span title={t.card.compositeHint} className="shrink-0 rounded-full bg-surface-strong px-md py-xs text-xs font-semibold text-text-muted">
                {t.card.composite}
              </span>
            )}
          </div>
          <p className="flex min-w-0 items-center gap-xs font-display text-2xl font-extrabold leading-tight sm:text-3xl">
            <DuelIcon name="pin" className="size-[calc(var(--spacing-lg)*1.25)] shrink-0 text-primary" />
            <span className="min-w-0 break-words">{card.metro}</span>
          </p>
          <h3 id={headingId} className="text-sm font-bold leading-snug text-text sm:text-base">
            {card.household}
          </h3>
          {card.caption && <p className="text-sm italic leading-snug text-text-muted">{t.card.quote(card.caption)}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 content-start gap-sm text-left lg:grid-cols-3">
        {/* `contents`: the list's items sit in the tile grid, next to the locked tile. */}
        <ul aria-label={t.card.factsLabel} className="contents">
          {card.facts.map((g) => (
            <FactGroup key={g.group} group={g} />
          ))}
          {card.hintFact && <HintTile fact={card.hintFact} />}
        </ul>
        {!card.hintFact && <HintTile fact={null} />}
      </div>

      {revealed && card.total !== null && (
        <div className="mt-auto flex flex-col gap-md border-t border-border pt-lg md:mt-0 md:self-start">
          <p className="flex flex-wrap items-baseline gap-sm">
            <Money
              value={card.total}
              className={cx(
                'font-display text-4xl font-extrabold leading-display tracking-tight sm:text-display',
                card.state === 'winner' ? 'text-primary' : 'text-text',
              )}
            />
            <span className="text-xl text-text-muted">{t.reveal.perMonth}</span>
          </p>
          <CategoryBar label={t.reveal.breakdownLabel(card.letter)} categories={card.categories} />
        </div>
      )}

      {pickable && (
        <>
          {/* What the tap does, drawn; the button below carries the name for screen readers. */}
          <span
            aria-hidden="true"
            className={cx(
              'mt-auto flex items-center justify-center gap-sm rounded-full py-md font-display text-lg font-extrabold transition-colors',
              card.state === 'picked'
                ? 'bg-primary text-on-primary'
                : 'bg-ink text-on-primary group-hover:bg-primary group-has-[button:focus-visible]:bg-primary',
            )}
          >
            {card.state === 'picked' ? t.card.picking : t.card.pickCta(card.letter)}
            <DuelIcon name="arrow" className="size-lg shrink-0 transition-transform group-hover:translate-x-xs" />
          </span>
          {/* The whole card is the tap target; the content above stays readable for screen readers. */}
          <button
            type="button"
            onClick={onPick}
            disabled={disabled}
            aria-label={t.card.pick(card.letter, card.metro)}
            aria-busy={card.state === 'picked'}
            className="absolute inset-0 z-10 cursor-pointer rounded-xl focus:outline-none disabled:cursor-wait"
          />
        </>
      )}
    </article>
  );
}
