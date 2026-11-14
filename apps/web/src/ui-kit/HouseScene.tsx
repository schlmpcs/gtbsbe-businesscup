'use client';

import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import type { ClueId, SceneLayout, SceneProp } from '@lifeguessr/types';
import { common } from '@/copy';
import { Button } from './Button';
import { cx } from './cx';
import { CLUE_ROOM_RECTS, DECOR_ROOM_GEOMETRY, rectStyle, zoomTransform } from './houseSceneGeometry';

const t = common.kit.houseScene;

export type HouseSceneRoomStatus = 'closed' | 'opening' | 'open' | 'error';

/** One clue room of the house. Everything shown comes in through these props. */
export type HouseSceneRoom = {
  id: ClueId;
  /** Room name ("Kitchen"); also the room button's accessible name. */
  label: string;
  status: HouseSceneRoomStatus;
  /** Short tag on a closed room (what opening it costs: "−10%", "Free", "Retry"). */
  badge: string;
  /** The room's state in words ("Tap to look (−10% points)", "Opening…", "Opened"). */
  hint: string;
  /** The room's revealed props (empty until it is open). */
  props: readonly SceneProp[];
  /** What the open room tells (facts), shown in the close-up. */
  details?: ReactNode;
  /** Why the room did not open (status 'error'). */
  error?: string;
};

export type HouseSceneProps = {
  layout: SceneLayout;
  /** The layout in words ("2-bedroom"). */
  layoutLabel: string;
  /** Always-visible decor (no clue), placed by its `room`. */
  decor: readonly SceneProp[];
  /** The clue rooms. A room missing here is drawn closed and cannot be tapped. */
  rooms: readonly HouseSceneRoom[];
  /** A closed (or failed) room was tapped: request its clue. Open rooms just zoom. */
  onOpenRoom: (id: ClueId) => void;
  /** Sprite id → words (alt text and captions). */
  spriteLabel: (sprite: string) => string;
  /** No more rooms can be opened (closed rooms are disabled; open ones still zoom). */
  disabled?: boolean;
  /** Streamer mode: bigger type. */
  large?: boolean;
  /** Small print under the house (e.g. that the art is a placeholder). */
  note?: ReactNode;
  /** Where sprite files live (default `/scene`, i.e. apps/web/public/scene/<id>.svg). */
  spriteBase?: string;
  className?: string;
};

const spriteSrc = (base: string, sprite: string) => `${base}/${sprite}.svg`;

/** Width of each prop in a room by how many there are (they wrap into rows). */
const propWidth = (n: number) => (n <= 1 ? 'w-[70%]' : n === 2 ? 'w-[46%]' : 'w-[31%]');

type SpriteProps = { base: string; sprite: string; alt: string; className?: string; style?: CSSProperties };

function Sprite({ base, sprite, alt, className, style }: SpriteProps) {
  // Plain <img>: the sprites are small static SVGs that need no resizing or optimisation.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={spriteSrc(base, sprite)}
      alt={alt}
      draggable={false}
      className={cx('block select-none', className)}
      style={style}
    />
  );
}

/**
 * The illustrated house (S2): a dollhouse cutaway with the layout, the decor and five closed clue
 * rooms. Tapping a room zooms the house into it and asks for its clue (`onOpenRoom`); the close-up
 * under the house shows the props and facts once the room is open. Rooms stay closed until then,
 * so nothing about the answer shows. Presentational: props in, events out; only the zoom is local.
 */
export function HouseScene({
  layout,
  layoutLabel,
  decor,
  rooms,
  onOpenRoom,
  spriteLabel,
  disabled = false,
  large = false,
  note,
  spriteBase = '/scene',
  className,
}: HouseSceneProps) {
  const [zoomedId, setZoomed] = useState<ClueId | null>(null);
  const closeUpHeading = useRef<HTMLHeadingElement>(null);
  const closeUpPanel = useRef<HTMLElement>(null);
  const roomButtons = useRef(new Map<ClueId, HTMLButtonElement>());
  const returnFocusTo = useRef<ClueId | null>(null);
  const baseId = useId();
  const decorId = `${baseId}-decor`;
  const closeUpId = `${baseId}-closeup`;

  const roomById = new Map(rooms.map((r) => [r.id, r]));
  // A zoomed room that is no longer in the props (another home) counts as not zoomed.
  const zoomedRoom = zoomedId ? (roomById.get(zoomedId) ?? null) : null;
  const zoomed = zoomedRoom ? zoomedId : null;

  // Move focus into the close-up when it opens, and back to the room's button when it closes.
  useEffect(() => {
    if (zoomed) {
      // Focus without the browser's jump, then bring the whole close-up into view (phones).
      closeUpHeading.current?.focus({ preventScroll: true });
      const panel = closeUpPanel.current;
      if (panel && typeof panel.scrollIntoView === 'function') {
        const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
        panel.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
      }
    } else if (returnFocusTo.current) {
      roomButtons.current.get(returnFocusTo.current)?.focus();
      returnFocusTo.current = null;
    }
  }, [zoomed]);

  const tapRoom = (room: HouseSceneRoom) => {
    setZoomed(room.id);
    if ((room.status === 'closed' || room.status === 'error') && !disabled) onOpenRoom(room.id);
  };

  const back = () => {
    returnFocusTo.current = zoomed;
    setZoomed(null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape' && zoomed) {
      e.stopPropagation();
      back();
    }
  };

  const decorRooms = DECOR_ROOM_GEOMETRY[layout];
  const decorText = decor.map((d) => spriteLabel(d.sprite)).join(', ');

  return (
    <div className={cx('flex flex-col gap-md', className)} onKeyDown={onKeyDown}>
      {/* The stage: the layout shell, decor and rooms on one 400 × 320 grid (5:4). */}
      <div
        role="group"
        aria-label={t.house(layoutLabel)}
        aria-describedby={decor.length > 0 ? decorId : undefined}
        className="relative aspect-[5/4] w-full overflow-hidden rounded-xl bg-surface shadow-md"
      >
        {decor.length > 0 && (
          <p id={decorId} className="sr-only">
            {t.decor(decorText)}
          </p>
        )}
        <div
          // While zoomed, the rooms are only a picture: the close-up below holds the controls.
          inert={zoomed !== null}
          data-zoomed={zoomed ?? undefined}
          className="absolute inset-0 origin-top-left transition-transform duration-500 ease-out motion-reduce:transition-none"
          style={{ transform: zoomed ? zoomTransform(CLUE_ROOM_RECTS[zoomed]) : undefined }}
        >
          <Sprite base={spriteBase} sprite={`layout/${layout}`} alt="" className="absolute inset-0 h-full w-full" />

          {decorRooms.map((room) => {
            const items = decor.filter((d) => d.room === room.id);
            if (items.length === 0) return null;
            return (
              <div key={room.id} aria-hidden="true" className="pointer-events-none absolute" style={rectStyle(room.rect)}>
                {items.slice(0, room.slots.length).map((d, i) => {
                  const slot = room.slots[i]!;
                  return (
                    <Sprite
                      key={`${d.sprite}-${i}`}
                      base={spriteBase}
                      sprite={d.sprite}
                      alt=""
                      className="absolute aspect-square h-auto"
                      // Slot positions are geometry (percent of the room), not design tokens.
                      style={{ left: `${slot.left}%`, top: `${slot.top}%`, width: `${slot.width}%` }}
                    />
                  );
                })}
              </div>
            );
          })}

          {(Object.keys(CLUE_ROOM_RECTS) as ClueId[]).map((id) => {
            const room = roomById.get(id);
            const rect = rectStyle(CLUE_ROOM_RECTS[id]);
            if (!room) {
              return <div key={id} aria-hidden="true" className="absolute rounded-sm bg-surface-strong" style={rect} />;
            }
            const open = room.status === 'open';
            const hintId = `${baseId}-${id}-hint`;
            return (
              <button
                key={id}
                ref={(el) => {
                  if (el) roomButtons.current.set(id, el);
                  else roomButtons.current.delete(id);
                }}
                type="button"
                aria-label={room.label}
                aria-describedby={hintId}
                aria-controls={zoomed === id ? closeUpId : undefined}
                aria-busy={room.status === 'opening' || undefined}
                disabled={disabled && !open}
                onClick={() => tapRoom(room)}
                data-room={id}
                data-status={room.status}
                className={cx(
                  'absolute flex flex-col items-center justify-center overflow-hidden rounded-sm p-xs text-center',
                  'transition-colors disabled:cursor-not-allowed',
                  open
                    ? 'bg-transparent hover:bg-text/5'
                    : 'border-2 border-ink bg-surface-strong text-text hover:bg-primary-soft disabled:opacity-70',
                  room.status === 'error' && 'border-negative',
                  room.status === 'opening' && 'motion-safe:animate-pulse',
                )}
                style={rect}
              >
                <span id={hintId} className="sr-only">
                  {room.hint}
                </span>
                {open ? (
                  <span aria-hidden="true" className="flex h-full w-full flex-wrap content-end items-end justify-center gap-[2%]">
                    {room.props.map((p, i) => (
                      <Sprite
                        key={`${p.sprite}-${i}`}
                        base={spriteBase}
                        sprite={p.sprite}
                        alt=""
                        className={cx('aspect-square h-auto', propWidth(room.props.length))}
                      />
                    ))}
                  </span>
                ) : (
                  <span aria-hidden="true" className="flex flex-col items-center gap-xs">
                    <span className={cx('font-display font-extrabold leading-tight', large ? 'text-base' : 'text-xs')}>
                      {room.label}
                    </span>
                    <span
                      className={cx(
                        'rounded-full px-sm font-bold leading-normal',
                        large ? 'text-sm' : 'text-xs',
                        room.status === 'error' ? 'bg-negative text-on-primary' : 'bg-primary text-on-primary',
                      )}
                    >
                      {room.badge}
                    </span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {zoomedRoom && (
        <section
          ref={closeUpPanel}
          id={closeUpId}
          aria-label={t.closeUp(zoomedRoom.label)}
          className="flex flex-col gap-md rounded-xl bg-surface p-lg shadow-md"
        >
          <div className="flex items-start justify-between gap-md">
            <h3
              ref={closeUpHeading}
              tabIndex={-1}
              className={cx('font-bold leading-tight focus:outline-none', large ? 'text-3xl' : 'text-xl')}
            >
              {zoomedRoom.label}
            </h3>
            <p
              aria-live="polite"
              className={cx(
                'shrink-0 text-sm font-medium',
                zoomedRoom.status === 'error' ? 'text-negative' : 'text-text-muted',
              )}
            >
              {zoomedRoom.status === 'error' ? zoomedRoom.error : zoomedRoom.hint}
            </p>
          </div>

          {zoomedRoom.status === 'open' && zoomedRoom.props.length > 0 && (
            <div className="flex flex-col gap-sm">
              <h4 className="sr-only">{t.inside}</h4>
              <ul className="flex flex-wrap gap-md">
                {zoomedRoom.props.map((p, i) => (
                  <li key={`${p.sprite}-${i}`} className="flex w-[calc(var(--spacing-3xl)*2)] flex-col items-center gap-xs text-center">
                    <Sprite
                      base={spriteBase}
                      sprite={p.sprite}
                      alt=""
                      className="aspect-square h-auto w-full rounded-md bg-surface-strong p-xs"
                    />
                    <span className={cx('leading-tight', large ? 'text-base' : 'text-sm')}>{spriteLabel(p.sprite)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {zoomedRoom.status === 'open' && zoomedRoom.details && (
            <div className={large ? 'text-xl' : 'text-base'}>{zoomedRoom.details}</div>
          )}

          <div className="flex flex-wrap gap-sm">
            <Button variant="secondary" onClick={back}>
              {t.back}
            </Button>
            {zoomedRoom.status === 'error' && !disabled && (
              <Button onClick={() => onOpenRoom(zoomedRoom.id)}>{t.retry}</Button>
            )}
          </div>
        </section>
      )}

      {note && <p className="text-xs text-text-muted">{note}</p>}
    </div>
  );
}
