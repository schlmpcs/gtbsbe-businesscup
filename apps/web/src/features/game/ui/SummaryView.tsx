import { useId } from 'react';
import { game as t } from '@/copy';
import { Art, Button, buttonClassName, cx } from '@/ui-kit';
import type { ShareStatus, ShareTileColor, SummaryVM } from '../model/types';

export type SummaryViewProps = {
  summary: SummaryVM;
  shareStatus: ShareStatus;
  onShare: () => void;
  /** S5 route: guess your own month. */
  guessOwnHref: string;
  large?: boolean;
};

/** The result squares: green in range, yellow 500+ points, black below (never red). */
const TILE: Record<ShareTileColor, string> = { green: 'bg-positive', yellow: 'bg-warning', red: 'bg-ink' };

/**
 * After five homes (Design v3): the giant in-range score, points and the result squares, the
 * takeaway, share; on the right the big orange bridge to pricing your own month.
 */
export function SummaryView({ summary, shareStatus, onShare, guessOwnHref, large = false }: SummaryViewProps) {
  const shareTextId = useId();
  const bridgeId = useId();
  const fmt = (n: number) => n.toLocaleString('en-US');
  const muted = large ? 'text-on-primary' : 'text-text-muted';

  return (
    <div className="grid grid-cols-1 gap-2xl lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start">
      <div className="flex min-w-0 flex-col gap-lg">
        <h2 className={cx('text-sm font-bold uppercase tracking-wide', muted)}>{t.summary.heading}</h2>
        <p className="flex flex-col gap-sm">
          <span
            className={cx(
              'font-display font-extrabold leading-display tabular-nums',
              large
                ? 'text-[length:calc(var(--text-display)*2.4)]'
                : 'text-[length:calc(var(--text-display)*1.6)] sm:text-[length:calc(var(--text-display)*2.2)]',
            )}
          >
            {t.summary.inRange(summary.inRange, summary.played)}
            <span className="sr-only"> {t.summary.inRangeLabel}</span>
          </span>
          <span className={cx('text-xl font-bold', large ? 'text-ink' : 'text-primary')}>
            {t.summary.pointsLine(fmt(summary.totalPoints), fmt(summary.maxPoints))}
          </span>
        </p>
        <div className="flex flex-col gap-sm">
          <ul aria-label={t.summary.gridLabel} className="flex flex-wrap gap-sm">
            {summary.tiles.map((tile, i) => (
              <li
                key={tile.cardId}
                className={cx('rounded-md shadow-sm', large ? 'size-[calc(var(--spacing-3xl)*1.6)]' : 'size-3xl', TILE[tile.color])}
              >
                <span className="sr-only">{t.summary.tile(i + 1, t.summary.tileResult[tile.color], fmt(tile.points))}</span>
              </li>
            ))}
          </ul>
          <p aria-hidden="true" className={cx('text-xs', muted)}>
            {t.summary.legend}
          </p>
        </div>

        {/* The main takeaway, from the view-model's counts. */}
        <div className="flex flex-col gap-sm rounded-xl bg-surface p-xl text-text shadow-md">
          <p className="text-xs font-bold uppercase tracking-wide text-primary">{t.summary.takeawayEyebrow}</p>
          <p className={cx('font-display font-extrabold leading-tight', large ? 'text-4xl' : 'text-3xl')}>
            {t.summary.bridge(summary.guessedLow, summary.played)}
          </p>
          <p className="text-sm text-text-muted">{t.summary.takeawayDetail(summary.guessedHigh, summary.inRange)}</p>
        </div>

        <div className="flex flex-col gap-sm">
          <div className="flex flex-wrap gap-sm">
            <Button
              variant={large ? 'dark' : 'secondary'}
              size="lg"
              onClick={onShare}
              disabled={shareStatus === 'sharing'}
            >
              {t.summary.share}
            </Button>
            {summary.mostSurprising?.shareImage && (
              <a
                href={summary.mostSurprising.shareImage.story}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClassName({ variant: large ? 'dark' : 'secondary', size: 'lg' })}
              >
                {t.summary.clipCard}
              </a>
            )}
          </div>
          <p role="status" className={cx('min-h-lg text-sm', muted)}>
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
                className="w-full rounded-md border border-border bg-surface p-md font-mono text-sm text-text"
              />
            </div>
          )}
          <p className={cx('text-sm', muted)}>{t.summary.nextFive}</p>
        </div>
      </div>

      {/* The bridge to S5: the most important CTA on the page. */}
      <section
        aria-labelledby={bridgeId}
        className={cx(
          'flex flex-col gap-lg rounded-xl bg-primary p-xl text-on-primary shadow-lg sm:p-2xl',
          large && 'ring-4 ring-on-primary',
        )}
      >
        <Art name="empty-plot" className="mx-auto w-full max-w-[calc(var(--spacing-3xl)*10)]" />
        <p className="text-xs font-bold uppercase tracking-wide">{t.summary.bridgeEyebrow}</p>
        <h2 id={bridgeId} className={cx('font-display font-extrabold leading-tight', large ? 'text-display' : 'text-4xl sm:text-display')}>
          {t.summary.bridgeHeading}
        </h2>
        <a
          href={guessOwnHref}
          className="inline-flex w-full items-center justify-center rounded-lg bg-surface px-2xl py-lg text-xl font-bold text-text shadow-md transition-colors hover:bg-primary-soft"
        >
          {t.summary.cta}
        </a>
      </section>
    </div>
  );
}
