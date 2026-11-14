// Room geometry of the house scene: where each room sits on the 400 × 320 stage. The layout
// sprites (public/scene/layout/*.svg) are drawn on this same grid, so a replacement shell must
// keep these rectangles (documented in public/scene/README.md → Room geometry).
import type { ClueId, SceneLayout } from '@lifeguessr/types';

/** Stage size in sprite units (the viewBox of the layout sprites). */
export const STAGE = { width: 400, height: 320 } as const;

/** A rectangle on the stage, in sprite units. */
export type Rect = { x: number; y: number; w: number; h: number };

/** The five clue rooms (tappable). */
export const CLUE_ROOM_RECTS: Record<ClueId, Rect> = {
  kidsRoom: { x: 84, y: 92, w: 80, h: 86 },
  entry: { x: 84, y: 178, w: 68, h: 106 },
  kitchen: { x: 152, y: 178, w: 76, h: 106 },
  garage: { x: 308, y: 190, w: 84, h: 94 },
  mailbox: { x: 10, y: 196, w: 68, h: 88 },
};

/** The upper floor right of the kids' room: one cell per bedroom (a studio has a sleeping loft). */
const BEDROOM_ZONE: Rect = { x: 164, y: 92, w: 140, h: 86 };

/** Bedroom cells of a layout (decor only), left to right, split evenly across the zone. */
function bedroomCells(count: number, firstId: (i: number) => string): { id: string; rect: Rect }[] {
  const w = BEDROOM_ZONE.w / count;
  return Array.from({ length: count }, (_, i) => ({
    id: firstId(i),
    rect: { x: BEDROOM_ZONE.x + i * w, y: BEDROOM_ZONE.y, w, h: BEDROOM_ZONE.h },
  }));
}

/** A spot for one decor sprite inside a decor room, in % of that room (left, top, width). */
export type DecorSlot = { left: number; top: number; width: number };

/** A decor room: its rectangle and the spots its decor sprites fill, in order. */
export type DecorRoomGeometry = { id: string; rect: Rect; slots: DecorSlot[] };

const LIVING: DecorRoomGeometry = {
  id: 'living',
  rect: { x: 228, y: 178, w: 76, h: 106 },
  // The window high on the wall, then two floor spots.
  slots: [
    { left: 18, top: 6, width: 64 },
    { left: 4, top: 52, width: 46 },
    { left: 52, top: 52, width: 46 },
  ],
};
const YARD: DecorRoomGeometry = { id: 'yard', rect: { x: 8, y: 104, w: 72, h: 88 }, slots: [{ left: 6, top: 4, width: 88 }] };
const FLOOR_PAIR: DecorSlot[] = [
  { left: 4, top: 40, width: 46 },
  { left: 50, top: 40, width: 46 },
];
const FLOOR_CENTER: DecorSlot[] = [{ left: 10, top: 34, width: 80 }];

/** Decor rooms per layout. Room ids match the engine's DECOR_ROOMS. */
export const DECOR_ROOM_GEOMETRY: Record<SceneLayout, DecorRoomGeometry[]> = {
  studio: [LIVING, YARD, ...bedroomCells(1, () => 'loft').map((c) => ({ ...c, slots: FLOOR_PAIR }))],
  '1bed': [LIVING, YARD, ...bedroomCells(1, (i) => `bedroom${i + 1}`).map((c) => ({ ...c, slots: FLOOR_CENTER }))],
  '2bed': [LIVING, YARD, ...bedroomCells(2, (i) => `bedroom${i + 1}`).map((c) => ({ ...c, slots: FLOOR_CENTER }))],
  '3bed': [LIVING, YARD, ...bedroomCells(3, (i) => `bedroom${i + 1}`).map((c) => ({ ...c, slots: FLOOR_CENTER }))],
  '4bed': [LIVING, YARD, ...bedroomCells(4, (i) => `bedroom${i + 1}`).map((c) => ({ ...c, slots: FLOOR_CENTER }))],
};

/** A rectangle as CSS percentages of the stage. */
export function rectStyle(r: Rect): { left: string; top: string; width: string; height: string } {
  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  return {
    left: pct(r.x, STAGE.width),
    top: pct(r.y, STAGE.height),
    width: pct(r.w, STAGE.width),
    height: pct(r.h, STAGE.height),
  };
}

/** How much a zoomed room fills the stage at most (the rest shows its surroundings). */
const ZOOM_FILL = 0.85;

/**
 * The CSS transform that zooms the stage into one room: scale it so the room fills about 85% of
 * the stage, centred, but never past the stage's edges (no empty space shows at the borders).
 * Use with `transform-origin: 0 0`.
 */
export function zoomTransform(r: Rect): string {
  const scale = ZOOM_FILL * Math.min(STAGE.width / r.w, STAGE.height / r.h);
  const axis = (start: number, size: number, of: number) => {
    const centre = ((start + size / 2) / of) * 100;
    const t = 50 - scale * centre;
    return Math.min(0, Math.max(100 - scale * 100, t));
  };
  const tx = axis(r.x, r.w, STAGE.width);
  const ty = axis(r.y, r.h, STAGE.height);
  return `translate(${round(tx)}%, ${round(ty)}%) scale(${round(scale)})`;
}

const round = (v: number) => Math.round(v * 1000) / 1000;
