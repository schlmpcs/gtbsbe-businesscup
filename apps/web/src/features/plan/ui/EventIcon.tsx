// Our event glyphs for plans and scenarios: simple rounded strokes (no sprite kit needed), each with its
// own soft color for the round badges on the chart. Decorative: the event's title always sits next to
// it or in its accessible name.
import type { CSSProperties } from 'react';
import { cx } from '@/ui-kit';
import type { PlanEventIconId } from '../model/types';

const PATHS: Record<PlanEventIconId, string> = {
  // A bill with a coin in the middle.
  cash: 'M3.5 7.5h17v9h-17z M12 9.75a2.25 2.25 0 1 0 0 4.5a2.25 2.25 0 1 0 0-4.5 M6.5 12h.01 M17.5 12h.01',
  // A receipt with a zig-zag bottom.
  receipt: 'M6.5 3.5h11v17l-2.2-1.5-2.2 1.5-2.2-1.5-2.2 1.5-2.2-1.5z M9.5 8h5 M9.5 11.5h5 M9.5 15h2.5',
  // A house with a chimney and a round door.
  home: 'M4 11.5 12 5l8 6.5 M6 10v9.5h12V10 M10.5 19.5v-3a1.5 1.5 0 0 1 3 0v3 M15.5 7V4.5h2V9',
  // A smiling baby face with a curl.
  kid: 'M12 4.5a7.5 7.5 0 1 0 0 15a7.5 7.5 0 1 0 0-15 M9.25 13.5c1.5 1.4 4 1.4 5.5 0 M9.5 10.5h.01 M14.5 10.5h.01 M12 4.5c-.9 1.2-.3 2.6 1.1 2.3',
  // A bag with a handle.
  briefcase: 'M4 8.5h16v10.5H4z M9 8.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v2.5 M4 13h16',
  // A round pause sign.
  pause: 'M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17 M10 9.5v5 M14 9.5v5',
  // A gift box with a bow.
  gift: 'M5 11h14v9H5z M4 8h16v3H4z M12 8v12 M12 8c-1.5-3.5-5-3.5-5-1.25S10.5 8 12 8c1.5 0 5 .25 5-1.25S13.5 4.5 12 8',
  // A beach umbrella and the sun.
  beach: 'M3.5 20h17 M12 20v-9 M4.5 11a7.5 7.5 0 0 1 15 0z M18.5 3.5v1 M21 6h-1',
  // A shield with a check.
  shield: 'M12 3.5l7.5 3v5.5c0 4.5-3.2 7.4-7.5 8.5c-4.3-1.1-7.5-4-7.5-8.5V6.5z M9 12l2 2 4-4',
};

/** Each event's badge color (chart tokens). */
const COLOR: Record<PlanEventIconId, string> = {
  cash: 'var(--color-chart-4)',
  receipt: 'var(--color-chart-6)',
  home: 'var(--color-chart-1)',
  kid: 'var(--color-chart-2)',
  briefcase: 'var(--color-chart-5)',
  pause: 'var(--color-chart-6)',
  gift: 'var(--color-chart-2)',
  beach: 'var(--color-chart-3)',
  shield: 'var(--color-chart-4)',
};

const KNOWN = new Set(Object.keys(PATHS));
const known = (id: string): PlanEventIconId => (KNOWN.has(id) ? id : 'home') as PlanEventIconId;

/** `id` is an event icon id; scenario icons are free strings and fall back to the home glyph. */
export function EventIcon({ id, className }: { id: PlanEventIconId | string; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={cx('size-lg shrink-0', className)} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[known(id)]} />
    </svg>
  );
}

/** Inline style for a round badge in the event's color: a soft fill and a ring. */
export function eventBadgeStyle(id: PlanEventIconId | string): CSSProperties {
  const c = COLOR[known(id)];
  return {
    background: `color-mix(in srgb, ${c} 24%, var(--color-surface))`,
    boxShadow: `0 0 0 2px ${c}`,
  };
}

/** A round badge with the event's glyph (decorative). */
export function EventBadge({ id, className }: { id: PlanEventIconId | string; className?: string }) {
  return (
    <span aria-hidden="true" className={cx('flex size-2xl shrink-0 items-center justify-center rounded-full text-text', className)} style={eventBadgeStyle(id)}>
      <EventIcon id={id} className="size-md" />
    </span>
  );
}
