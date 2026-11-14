import { useId } from 'react';
import { game as t } from '@/copy';
import { Sticker, cx, formatRate } from '@/ui-kit';
import type { ExploreCardVM } from '../model/types';

export type HomeCardProps = {
  card: ExploreCardVM;
  /** "Home 3 of 5" (null when not shown). */
  progressLabel?: string | null;
  /** Streamer mode: on the orange page, white type. */
  large?: boolean;
  /** List the decor as chips (off when the house scene draws it). */
  showDecor?: boolean;
};

/** What is visible before any clue: the metro (big), the caption, layout (and decor) chips, and the clue cost. */
export function HomeCard({ card, progressLabel = null, large = false, showDecor = true }: HomeCardProps) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex min-w-0 flex-col gap-md">
      {progressLabel && (
        <Sticker tone="ink" className="text-sm">
          {progressLabel}
        </Sticker>
      )}
      <h2
        id={headingId}
        className="font-display text-4xl font-extrabold leading-display break-words sm:text-display"
      >
        {card.metro}
      </h2>
      <p className={cx(large ? 'text-2xl text-on-primary' : 'text-xl text-text-muted')}>{card.caption}</p>
      <ul aria-label={t.home.about} className="flex flex-wrap gap-sm">
        <li className="rounded-full bg-surface px-md py-xs text-sm font-semibold text-text shadow-sm">
          {t.home.layouts[card.layout]}
        </li>
        {showDecor && card.decor.map((d, i) => (
          <li
            key={`${d.sprite}-${i}`}
            className="rounded-full border border-border bg-surface px-md py-xs text-sm text-text"
          >
            {t.scene.sprite(d.sprite)}
          </li>
        ))}
      </ul>
      <p className={cx('text-sm font-medium', large ? 'text-on-primary' : 'text-text-muted')}>
        {card.clueCost > 0 ? t.multiplier.cost(formatRate(card.clueCost)) : t.multiplier.floor}
      </p>
    </section>
  );
}
