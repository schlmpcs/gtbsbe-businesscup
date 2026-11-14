import { useId } from 'react';
import { duel as t } from '@/copy';
import { Button, Card, Stat, buttonClassName, cx } from '@/ui-kit';
import type { DuelCopyStatus, DuelShareStatus, DuelSummaryVM, DuelTileColor } from '../model/types';

export type DuelSummaryProps = {
  summary: DuelSummaryVM;
  copyStatus: DuelCopyStatus;
  shareStatus: DuelShareStatus;
  onCopyChallenge: () => void;
  onShare: () => void;
  /** S5 route: price your own month. */
  guessOwnHref: string;
  onGuessOwn: () => void;
};

const TILE: Record<DuelTileColor, string> = {
  green: 'bg-positive',
  yellow: 'bg-warning',
  ink: 'bg-ink',
};

/** S3 Day result: score, the five-tile grid, your blind spot, the challenge link, share, and the bridge to S5. */
export function DuelSummary({
  summary, copyStatus, shareStatus, onCopyChallenge, onShare, guessOwnHref, onGuessOwn,
}: DuelSummaryProps) {
  const linkId = useId();
  const fmt = (n: number) => n.toLocaleString('en-US');
  return (
    <div className="grid grid-cols-1 gap-xl lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-start">
      <Card className="text-text">
        <div className="flex flex-col gap-lg">
          <h2 className="font-display text-4xl font-extrabold leading-tight">{t.summary.heading}</h2>
          <div className="flex flex-wrap gap-2xl">
            <Stat label={t.summary.scoreLabel} value={t.summary.score(summary.right, summary.rounds)} size="lg" />
            <Stat label={t.summary.pointsLabel} value={t.summary.points(fmt(summary.totalPoints))} size="lg" />
          </div>
          <ol aria-label={t.summary.gridLabel} className="flex gap-sm">
            {summary.tiles.map((tile) => (
              <li key={tile.round} className={cx('size-3xl rounded-md shadow-sm', TILE[tile.color])}>
                <span className="sr-only">{t.summary.tileLabel(tile.round, t.summary.tile[tile.color])}</span>
              </li>
            ))}
          </ol>

          <div className="flex flex-col gap-xs rounded-lg bg-surface-strong p-lg">
            <p className="text-sm font-bold uppercase tracking-wide text-text-muted">{t.summary.blindSpotHeading}</p>
            <p className="font-display text-2xl font-extrabold leading-tight">
              {summary.blindSpot ? t.blindSpots[summary.blindSpot] : t.summary.noBlindSpot}
            </p>
          </div>

          <div className="flex flex-col gap-sm">
            <div className="flex flex-col gap-sm sm:flex-row">
              <Button variant="secondary" onClick={onCopyChallenge} className="sm:flex-1">
                {t.summary.copyChallenge(summary.right, summary.rounds)}
              </Button>
              <Button variant="secondary" onClick={onShare} disabled={shareStatus === 'sharing'}>
                {t.summary.share}
              </Button>
            </div>
            <p role="status" className="min-h-lg text-sm text-text-muted">
              {copyStatus !== 'idle' ? t.summary.copyStatus[copyStatus] : t.summary.shareStatus[shareStatus]}
            </p>
            {(copyStatus === 'failed' || shareStatus === 'failed') && (
              <div className="flex flex-col gap-xs">
                <label htmlFor={linkId} className="text-sm font-medium">
                  {t.summary.challengeLinkLabel}
                </label>
                <input
                  id={linkId}
                  readOnly
                  value={summary.challengeUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full rounded-md border border-border bg-bg p-md font-mono text-sm"
                />
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card tone="arena" className="lg:rotate-1">
        <div className="flex flex-col gap-md">
          <p className="font-display text-3xl font-extrabold leading-tight">{t.summary.ctaLead}</p>
          <a href={guessOwnHref} onClick={onGuessOwn} className={buttonClassName({ variant: 'dark', size: 'lg', fullWidth: true })}>
            {t.summary.cta}
          </a>
          <p className="text-sm font-semibold">{t.summary.nextIn(summary.nextIn.hours, summary.nextIn.minutes)}</p>
        </div>
      </Card>
    </div>
  );
}
