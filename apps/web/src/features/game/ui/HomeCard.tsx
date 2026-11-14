import { game as t } from '@/copy';
import { Card, cx, formatRate } from '@/ui-kit';
import type { ExploreCardVM } from '../model/types';

/**
 * The home card: what is visible before any clue (metro, layout, caption, and the decor as words
 * unless the house scene draws it) and the multiplier.
 */
export function HomeCard({
  card,
  large = false,
  showDecor = true,
}: {
  card: ExploreCardVM;
  large?: boolean;
  showDecor?: boolean;
}) {
  return (
    <Card title={t.home.label} className="flex flex-col">
      <dl className={cx('grid grid-cols-2 gap-md', large ? 'text-xl' : 'text-base')}>
        <div className="flex min-w-0 flex-col">
          <dt className="text-sm text-text-muted">{t.home.metro}</dt>
          <dd className="font-semibold">{card.metro}</dd>
        </div>
        <div className="flex min-w-0 flex-col">
          <dt className="text-sm text-text-muted">{t.home.layout}</dt>
          <dd className="font-semibold">{t.home.layouts[card.layout]}</dd>
        </div>
      </dl>
      <blockquote className={cx('mt-md border-l-4 border-border pl-md italic', large ? 'text-2xl' : 'text-lg')}>
        {card.caption}
      </blockquote>
      {showDecor && card.decor.length > 0 && (
        <div className="mt-md flex flex-col gap-xs">
          <p className="text-sm text-text-muted">{t.home.decor}</p>
          <ul className="flex flex-wrap gap-sm">
            {card.decor.map((d, i) => (
              <li key={`${d.sprite}-${i}`} className="rounded-full bg-surface px-md py-xs text-sm">
                {t.scene.sprite(d.sprite)}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-md flex flex-col gap-xs border-t border-border pt-md">
        <p className="flex items-baseline justify-between gap-md">
          <span className="text-sm text-text-muted">{t.multiplier.label}</span>
          <span className={cx('font-semibold tabular-nums', large ? 'text-3xl' : 'text-xl')}>
            {formatRate(card.multiplier)}
          </span>
        </p>
        <p className="text-sm text-text-muted">
          {card.clueCost > 0 ? t.multiplier.cost(formatRate(card.clueCost)) : t.multiplier.floor}
        </p>
      </div>
    </Card>
  );
}
