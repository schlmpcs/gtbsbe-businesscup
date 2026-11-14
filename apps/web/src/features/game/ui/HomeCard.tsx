import { useId } from 'react';
import { game as t } from '@/copy';
import { Sticker, cx, formatRate } from '@/ui-kit';
import type { ExploreCardVM } from '../model/types';

export type HomeCardProps = {
  card: ExploreCardVM;
  /** "Home 3 of 5" (null when not shown; PlayScreen shows it in the round sticker on top). */
  progressLabel?: string | null;
  /** Streamer mode: bigger type. */
  large?: boolean;
  /** List the decor as chips (off when the house scene draws it). */
  showDecor?: boolean;
};

const chip = 'inline-flex items-center rounded-full bg-surface-strong px-md py-xs text-sm font-medium text-text';

/** What is visible before any clue, as a white card: the metro (big), the caption, layout (and decor) chips, and the clue cost. */
export function HomeCard({ card, progressLabel = null, large = false, showDecor = true }: HomeCardProps) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="flex min-w-0 flex-col gap-md rounded-xl bg-surface p-xl text-text shadow-md"
    >
      {progressLabel && (
        <Sticker tone="ink" className="text-sm">
          {progressLabel}
        </Sticker>
      )}
      <h2
        id={headingId}
        className={cx('font-display font-extrabold leading-tight break-words', large ? 'text-display' : 'text-3xl sm:text-4xl')}
      >
        {card.metro}
      </h2>
      <p className={cx('text-text-muted', large ? 'text-2xl' : 'text-lg')}>{card.caption}</p>
      <ul aria-label={t.home.about} className="flex flex-wrap gap-sm">
        <li className={chip}>{t.home.layouts[card.layout]}</li>
        {showDecor &&
          card.decor.map((d, i) => (
            <li key={`${d.sprite}-${i}`} className={chip}>
              {t.scene.sprite(d.sprite)}
            </li>
          ))}
      </ul>
      <div className="flex flex-wrap items-center gap-sm">
        {card.openedCount > 0 && (
          <Sticker tone="soft">
            {t.home.cluesUsed(card.openedCount)}
          </Sticker>
        )}
        <p className="text-sm font-medium text-text-muted">
          {card.clueCost > 0 ? t.multiplier.cost(formatRate(card.clueCost)) : t.multiplier.floor}
        </p>
      </div>
    </section>
  );
}
