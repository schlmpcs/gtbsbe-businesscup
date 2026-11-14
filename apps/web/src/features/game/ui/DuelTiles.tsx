import { duel as t } from '@/copy';
import { cx } from '@/ui-kit';
import type { DuelScoreVM } from '../model/types';

const TILE = {
  green: 'bg-positive',
  yellow: 'bg-warning',
  ink: 'bg-ink',
} as const;

const SIZE = {
  /** The day result's own grid. */
  lg: 'size-[calc(var(--spacing-3xl)*1.3)]',
  /** Two grids stacked in the comparison card: five tiles still fit a phone inside the card's padding. */
  md: 'size-[calc(var(--spacing-3xl)*0.9)]',
} as const;

/** The day's grid: one tile per round, green = right, yellow = right with a hint, ink = missed. */
export function DuelTiles({ tiles, label, size = 'lg' }: { tiles: DuelScoreVM['tiles']; label: string; size?: keyof typeof SIZE }) {
  return (
    <ol aria-label={label} className="flex gap-sm">
      {tiles.map((tile) => (
        <li key={tile.round} className={cx('rounded-lg shadow-sm', SIZE[size], TILE[tile.color])}>
          <span className="sr-only">{t.summary.tileLabel(tile.round, t.summary.tile[tile.color])}</span>
        </li>
      ))}
    </ol>
  );
}
