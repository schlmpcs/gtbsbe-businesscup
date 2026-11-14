import { game as t } from '@/copy';
import { cx } from '@/ui-kit';
import type { DayVM } from '../model/types';

/** Today's five homes as small tiles: points once guessed, "Now" on the current one. */
export function HomeStrip({ day }: { day: DayVM }) {
  return (
    <ol aria-label={t.day.label} className="flex flex-wrap gap-sm">
      {day.homes.map((home, i) => {
        const points = home.points?.toLocaleString('en-US');
        const spoken =
          points !== undefined ? t.day.homeDone(i + 1, points) : home.current ? t.day.homeNow(i + 1) : t.day.homeLater(i + 1);
        return (
          <li
            key={home.cardId}
            className={cx(
              'flex h-3xl min-w-3xl items-center justify-center rounded-md bg-surface px-sm text-xs font-bold shadow-sm tabular-nums',
              home.current ? 'border-2 border-primary text-primary uppercase' : 'border-2 border-surface',
              !home.current && (points !== undefined ? 'text-positive' : 'text-text-muted'),
            )}
          >
            <span aria-hidden="true">{points !== undefined ? t.day.points(points) : home.current ? t.day.now : '·'}</span>
            <span className="sr-only">{spoken}</span>
          </li>
        );
      })}
    </ol>
  );
}
