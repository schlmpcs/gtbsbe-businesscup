// Stroke glyphs for plan events and scenarios (placeholders until the sprite kit). Decorative: the
// event's title always sits next to it or in its accessible name.
import { cx } from '@/ui-kit';
import type { PlanEventIconId } from '../model/types';

const PATHS: Record<PlanEventIconId, string> = {
  cash: 'M3 7h18v10H3z M12 9.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5 M6 10v4 M18 10v4',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2z M9 8h6 M9 12h6 M9 16h3',
  home: 'M3 11l9-7 9 7 M5 10v10h14V10 M10 20v-6h4v6',
  kid: 'M12 8a3 3 0 1 0 0-6a3 3 0 1 0 0 6 M6 22v-6a6 6 0 0 1 12 0v6 M9 22v-4 M15 22v-4',
  briefcase: 'M3 8h18v12H3z M8 8V5h8v3 M3 13h18',
  pause: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18 M10 9v6 M14 9v6',
  gift: 'M4 10h16v11H4z M3 7h18v3H3z M12 7v14 M12 7c-2-4-6-4-6-1s4 1 6 1c2 0 6 2 6-1s-4-3-6 1',
  beach: 'M4 20h16 M12 20l-2-11 M5 10c1-5 9-7 13-3c-4-1-8 1-13 3z',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9c-4.5-1-8-4-8-9V6z M9 12l2 2 4-4',
};

const KNOWN = new Set(Object.keys(PATHS));

/** `id` is an event icon id; scenario icons are free strings and fall back to the home glyph. */
export function EventIcon({ id, className }: { id: PlanEventIconId | string; className?: string }) {
  const d = PATHS[(KNOWN.has(id) ? id : 'home') as PlanEventIconId];
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={cx('size-lg shrink-0', className)} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}
