'use client';

// S2/S4 clue panel drawn with the 3D sprite kit (D1, apps/web/public/scene/<id>.webp).
// The card's layout render shows the whole home with every clue room closed (no car, toys,
// takeout or coats). The five clue rooms are buttons placed on the render (listed under it on
// phones). Tapping one zooms the render into that room, opens the clue (onOpenClue) and shows a
// close-up with the props from its ClueReveal: the art never shows a fact before it is opened
// and never contradicts the card. Same slot props and behavior as the 2D ui-kit HouseScene, so
// PlayScreen can use either; ClueBoard stays as the text fallback.
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { common, game as t } from '@/copy';
import { Button, cx, formatRate, SpriteImage } from '@/ui-kit';
import type { ClueId, ClueVM, ExploreCardVM } from '../model/types';
import type { ClueBoardProps } from './ClueBoard';
import { ClueFacts } from './ClueFacts';

const k = common.kit.houseScene;

type Spot = { x: number; y: number };

/** Where each clue room sits on the layout render, in % of the image (one composition per kit). */
const SPOTS: Record<ExploreCardVM['layout'], Record<ClueId, Spot>> = {
  studio: { kidsRoom: { x: 25, y: 20 }, kitchen: { x: 15, y: 42 }, entry: { x: 32, y: 62 }, garage: { x: 78, y: 62 }, mailbox: { x: 55, y: 82 } },
  '1bed': { kidsRoom: { x: 18, y: 22 }, kitchen: { x: 20, y: 52 }, entry: { x: 45, y: 70 }, garage: { x: 82, y: 52 }, mailbox: { x: 72, y: 78 } },
  '2bed': { kidsRoom: { x: 25, y: 18 }, kitchen: { x: 12, y: 52 }, entry: { x: 38, y: 66 }, garage: { x: 72, y: 44 }, mailbox: { x: 60, y: 86 } },
  '3bed': { kidsRoom: { x: 24, y: 18 }, kitchen: { x: 14, y: 42 }, entry: { x: 40, y: 66 }, garage: { x: 72, y: 58 }, mailbox: { x: 58, y: 80 } },
  '4bed': { kidsRoom: { x: 26, y: 18 }, kitchen: { x: 22, y: 52 }, entry: { x: 40, y: 66 }, garage: { x: 76, y: 46 }, mailbox: { x: 84, y: 82 } },
};

const ZOOM = 1.9;

const spotStyle = (s: Spot) => ({ '--x': `${s.x}%`, '--y': `${s.y}%` }) as CSSProperties;

/** The props of an opened room, grouped (two adult coats → one coat ×2). */
function propsOf(clue: ClueVM): { sprite: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const p of clue.reveal?.props ?? []) counts.set(p.sprite, (counts.get(p.sprite) ?? 0) + 1);
  return [...counts].map(([sprite, count]) => ({ sprite, count }));
}

function hintOf(clue: ClueVM, card: ExploreCardVM, disabled: boolean): string {
  if (clue.status === 'open') return t.clues.opened;
  if (clue.status === 'opening') return t.clues.opening;
  if (disabled) return t.clues.lockedHint;
  return card.clueCost > 0 ? t.clues.closedHint(formatRate(card.clueCost)) : t.clues.closedFreeHint;
}

function badgeOf(clue: ClueVM, card: ExploreCardVM): string {
  if (clue.status === 'open') return '✓';
  if (clue.status === 'error') return t.scene.errorBadge;
  return card.clueCost > 0 ? t.scene.costBadge(formatRate(card.clueCost)) : t.scene.freeBadge;
}

/** A new home (card id) starts with the whole house in view. */
export function HouseScene3D(props: ClueBoardProps) {
  return <Scene key={props.card.id} {...props} />;
}

function Scene({ card, onOpenClue, disabled = false, large = false }: ClueBoardProps) {
  const headingId = useId();
  const baseId = useId();
  const [zoomed, setZoomed] = useState<ClueId | null>(null);
  const roomButtons = useRef(new Map<ClueId, HTMLButtonElement>());
  const closeUpHeading = useRef<HTMLHeadingElement>(null);
  const returnTo = useRef<ClueId | null>(null);
  const spots = SPOTS[card.layout] ?? SPOTS['2bed'];

  // Focus moves into the close-up when it opens and back to the room's button when it closes.
  useEffect(() => {
    if (zoomed) {
      closeUpHeading.current?.focus({ preventScroll: true });
      // Bring the close-up into view on phones (not every environment implements scrollIntoView).
      const panel = closeUpHeading.current?.closest('section');
      if (panel && typeof panel.scrollIntoView === 'function') panel.scrollIntoView({ block: 'nearest' });
    } else if (returnTo.current) {
      roomButtons.current.get(returnTo.current)?.focus();
      returnTo.current = null;
    }
  }, [zoomed]);

  const open = (clue: ClueVM) => {
    if (clue.status === 'closed' || clue.status === 'error') {
      if (disabled) return;
      onOpenClue(clue.id);
    }
    setZoomed(clue.id);
  };
  const back = () => {
    returnTo.current = zoomed;
    setZoomed(null);
  };

  const zoomedClue = zoomed ? card.clues.find((c) => c.id === zoomed) ?? null : null;
  const origin = zoomed ? spots[zoomed] : null;
  const closeUpId = `${baseId}-closeup`;

  return (
    <section aria-labelledby={headingId} className="min-w-0 rounded-xl bg-surface p-xs text-text shadow-lg sm:p-md lg:-rotate-1">
      <div className="flex flex-col gap-md rounded-lg bg-surface-strong p-sm sm:p-lg">
        <div className="flex flex-col gap-xs">
          <h2 id={headingId} className={cx('font-display font-extrabold leading-tight', large ? 'text-4xl' : 'text-2xl')}>
            {t.clues.heading}
          </h2>
          <p className="text-sm text-text-muted">{t.clues.intro}</p>
        </div>

        <div className="relative">
          {/* The render, zoomed toward the open room's spot. */}
          <div className="overflow-hidden rounded-lg bg-surface">
            <div
              style={origin ? { transform: `scale(${ZOOM})`, transformOrigin: `${origin.x}% ${origin.y}%` } : undefined}
              className="transition-transform duration-500 ease-out motion-reduce:transition-none"
            >
              <SpriteImage id={`layout/${card.layout}`} alt={k.house(t.home.layouts[card.layout])} />
            </div>
          </div>

          {/* Room buttons: on the render (wide screens), under it (phones). Inert while zoomed. */}
          <ul
            inert={zoomed !== null}
            className={cx(
              'mt-md grid grid-cols-1 gap-sm sm:grid-cols-2 lg:pointer-events-none lg:absolute lg:inset-0 lg:mt-0 lg:block',
              'transition-opacity duration-300 motion-reduce:transition-none',
              // While zoomed: no gap on phones (the list collapses), invisible over the art on wide screens.
              zoomed && 'max-lg:hidden lg:opacity-0',
            )}
          >
            {card.clues.map((clue) => {
              const hintId = `${baseId}-${clue.id}-hint`;
              const isOpen = clue.status === 'open';
              return (
                <li
                  key={clue.id}
                  style={spotStyle(spots[clue.id])}
                  className="lg:pointer-events-auto lg:absolute lg:top-(--y) lg:left-(--x) lg:-translate-x-1/2 lg:-translate-y-1/2"
                >
                  <button
                    type="button"
                    ref={(el) => {
                      if (el) roomButtons.current.set(clue.id, el);
                      else roomButtons.current.delete(clue.id);
                    }}
                    onClick={() => open(clue)}
                    disabled={!isOpen && (disabled || clue.status === 'opening')}
                    aria-describedby={hintId}
                    aria-controls={zoomed === clue.id ? closeUpId : undefined}
                    data-status={clue.status}
                    className={cx(
                      'flex w-full items-center justify-between gap-md rounded-full border-2 bg-surface px-lg py-sm text-left font-bold shadow-md lg:w-max lg:px-md lg:py-xs',
                      'transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                      isOpen ? 'border-ink hover:bg-surface-strong' : 'border-primary hover:bg-primary-soft',
                      large ? 'text-xl' : 'text-base lg:text-sm',
                    )}
                  >
                    <span>{t.clues.rooms[clue.id]}</span>
                    <span aria-hidden="true" className={cx('text-xs font-bold', isOpen ? 'text-text' : 'text-primary')}>
                      {badgeOf(clue, card)}
                    </span>
                  </button>
                  <span id={hintId} className="sr-only">
                    {hintOf(clue, card, disabled)}
                  </span>
                  {clue.status === 'error' && !zoomed && (
                    <p role="alert" className="mt-xs rounded-md bg-surface px-md text-sm font-medium text-negative lg:hidden">
                      {t.clues.rooms[clue.id]}: {t.errors.clue}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {zoomedClue && (
          <section
            id={closeUpId}
            aria-label={k.closeUp(t.clues.rooms[zoomedClue.id])}
            aria-live="polite"
            className={cx('flex flex-col gap-md rounded-lg border-2 border-ink bg-surface p-md shadow-md', large ? 'text-xl' : 'text-base')}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-md">
              <h3 ref={closeUpHeading} tabIndex={-1} className="text-xl font-bold outline-none">
                {t.clues.rooms[zoomedClue.id]}
              </h3>
              <span className="text-xs font-bold uppercase tracking-wide text-text-muted">
                {zoomedClue.status === 'open' ? t.clues.opened : zoomedClue.status === 'opening' ? t.clues.opening : null}
              </span>
            </div>

            {zoomedClue.status === 'open' && propsOf(zoomedClue).length > 0 && (
              <div className="flex flex-col gap-xs">
                <p className="text-sm font-semibold text-text-muted">{k.inside}</p>
                <div className="flex flex-wrap gap-sm">
                  {propsOf(zoomedClue).map((p) => (
                    <figure key={p.sprite} className="relative w-28 shrink-0 sm:w-36">
                      <SpriteImage id={p.sprite} alt={t.scene.sprite(p.sprite)} className="rounded-md bg-surface-strong" />
                      {p.count > 1 && (
                        <span className="absolute right-xs bottom-xs rounded-full bg-ink px-sm text-xs font-bold text-on-primary">
                          {t.scene.count(p.count)}
                        </span>
                      )}
                    </figure>
                  ))}
                </div>
              </div>
            )}

            {zoomedClue.facts.length > 0 && <ClueFacts facts={zoomedClue.facts} className="text-sm font-medium" />}

            {zoomedClue.status === 'error' && (
              <div className="flex flex-wrap items-center gap-sm">
                <p role="alert" className="text-sm font-medium text-negative">
                  {t.errors.clue}
                </p>
                <Button size="sm" variant="secondary" onClick={() => onOpenClue(zoomedClue.id)} disabled={disabled}>
                  {k.retry}
                </Button>
              </div>
            )}

            <div>
              <Button size="sm" variant="secondary" onClick={back}>
                {k.back}
              </Button>
            </div>
          </section>
        )}
      </div>
    </section>
  );
}
