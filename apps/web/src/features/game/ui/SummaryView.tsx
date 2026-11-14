import { useId } from 'react';
import { game as t } from '@/copy';
import { Button, Card, Stat, buttonClassName, cx } from '@/ui-kit';
import type { ShareStatus, SummaryVM } from '../model/types';

export type SummaryViewProps = {
  summary: SummaryVM;
  shareStatus: ShareStatus;
  onShare: () => void;
  /** S5 route: guess your own month. */
  guessOwnHref: string;
  large?: boolean;
};

/** After five homes: the spoiler-free emoji grid, share, and the bridge to guessing your own life. */
export function SummaryView({ summary, shareStatus, onShare, guessOwnHref, large = false }: SummaryViewProps) {
  const shareTextId = useId();
  const fmt = (n: number) => n.toLocaleString('en-US');
  return (
    <div className="grid grid-cols-1 gap-xl lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-start">
      <Card className={cx('text-text', large && 'ring-4 ring-on-primary')}>
        <div className="flex flex-col gap-lg">
          <h2 className={cx('font-display font-extrabold leading-tight', large ? 'text-display' : 'text-4xl')}>
            {t.summary.heading}
          </h2>
          <ul aria-label={t.summary.gridLabel} className="flex flex-wrap gap-sm">
            {summary.tiles.map((tile, i) => (
              <li key={tile.cardId} className={cx(large ? 'text-display' : 'text-4xl', 'leading-none')}>
                <span aria-hidden="true">{t.share.tiles[tile.color]}</span>
                <span className="sr-only">{t.summary.tile(i + 1, t.summary.tileResult[tile.color], fmt(tile.points))}</span>
              </li>
            ))}
          </ul>
          <Stat
            label={t.summary.total}
            value={t.reveal.pointsOf(fmt(summary.totalPoints), fmt(summary.maxPoints))}
            size={large ? 'display' : 'lg'}
          />
          <div className="flex flex-col gap-sm">
            <Button variant="secondary" size="lg" onClick={onShare} disabled={shareStatus === 'sharing'}>
              {t.summary.share}
            </Button>
            <p role="status" className="min-h-lg text-sm text-text-muted">
              {t.summary.shareStatus[shareStatus]}
            </p>
            {shareStatus === 'failed' && (
              <div className="flex flex-col gap-xs">
                <label htmlFor={shareTextId} className="text-sm font-medium">
                  {t.summary.shareTextLabel}
                </label>
                <textarea
                  id={shareTextId}
                  readOnly
                  rows={3}
                  value={summary.shareText}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full rounded-md border border-border bg-bg p-md font-mono text-sm"
                />
              </div>
            )}
            {summary.mostSurprising?.shareImage && (
              <a
                href={summary.mostSurprising.shareImage.story}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm underline underline-offset-2"
              >
                {t.summary.clipCard}
              </a>
            )}
          </div>
        </div>
      </Card>

      <Card tone="arena" className="lg:rotate-1">
        <div className="flex flex-col gap-md">
          <p className={cx('font-display font-extrabold leading-tight', large ? 'text-4xl' : 'text-3xl')}>
            {t.summary.bridge(summary.guessedLow, summary.played)}
          </p>
          <a href={guessOwnHref} className={buttonClassName({ variant: 'dark', size: 'lg', fullWidth: true })}>
            {t.summary.cta}
          </a>
        </div>
      </Card>
    </div>
  );
}
