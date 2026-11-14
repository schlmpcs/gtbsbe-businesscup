import { game as t } from '@/copy';
import { cx } from '@/ui-kit';
import type { DayVM } from '../model/types';

/**
 * Today's five homes as the round progress: short pill segments, green once guessed, orange on the
 * current one, a plain line for the ones still to come. Points are spoken, not drawn.
 */
export function HomeStrip({ day, large = false, className }: { day: DayVM; large?: boolean; className?: string }) {
  return (
    <ol aria-label={t.day.label} className={cx('flex items-center justify-center gap-sm', className)}>
      {day.homes.map((home, i) => {
        const points = home.points?.toLocaleString('en-US');
        const spoken =
          points !== undefined ? t.day.homeDone(i + 1, points) : home.current ? t.day.homeNow(i + 1) : t.day.homeLater(i + 1);
        return (
          <li key={home.cardId} className="flex">
            <span
              aria-hidden="true"
              className={cx(
                'h-xs w-2xl rounded-full',
                // On the orange streamer page the current segment is ink, so it stays visible.
                points !== undefined ? 'bg-positive' : home.current ? (large ? 'bg-ink' : 'bg-primary') : 'bg-border',
              )}
            />
            <span className="sr-only">{spoken}</span>
          </li>
        );
      })}
    </ol>
  );
}
