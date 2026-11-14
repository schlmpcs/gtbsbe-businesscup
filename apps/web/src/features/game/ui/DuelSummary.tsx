import { useId } from 'react';
import { duel as t } from '@/copy';
import { Art, Button, cx } from '@/ui-kit';
import type { DuelCopyStatus, DuelShareStatus, DuelSummaryVM } from '../model/types';
import { DuelVersus, type FriendChallengeVM } from './DuelChallenge';
import { DuelTiles } from './DuelTiles';

export type DuelSummaryProps = {
  summary: DuelSummaryVM;
  copyStatus: DuelCopyStatus;
  shareStatus: DuelShareStatus;
  onCopyChallenge: () => void;
  onShare: () => void;
  onGuessOwn: () => void;
  /** S5 route: price your own month. */
  guessOwnHref: string;
  /** Opened from a friend's challenge link: their score, set against yours once `comparison` is there. */
  challenge?: FriendChallengeVM | null;
};

/** The white button of Design v3 (on the page background and on the orange card). */
const WHITE_BUTTON =
  'inline-flex items-center justify-center gap-sm rounded-lg bg-surface px-2xl py-lg font-bold text-text shadow-md transition-colors hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-50';

/**
 * S3 Day result (Figma Design v3): the score, the five-tile grid, your blind spot, the challenge link
 * and share on the left; the orange bridge to S5 ("Price my own month") on the right.
 */
export function DuelSummary({
  summary, copyStatus, shareStatus, onCopyChallenge, onShare, onGuessOwn, guessOwnHref, challenge = null,
}: DuelSummaryProps) {
  const linkId = useId();
  const comparison = challenge?.comparison ?? null;
  const fmt = (n: number) => n.toLocaleString('en-US');
  return (
    <div className="grid grid-cols-1 gap-2xl lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start">
      <div className="flex flex-col gap-xl text-text">
        <div className="flex flex-col gap-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-text-muted">{t.summary.heading}</h2>
          <p className="font-display text-[length:calc(var(--text-display)*1.6)] font-extrabold leading-display tracking-tight lg:text-[length:calc(var(--text-display)*2.2)]">
            <span className="sr-only">{t.summary.scoreLabel}: </span>
            {t.summary.score(summary.right, summary.rounds)}
          </p>
          <p className="font-display text-2xl font-bold text-primary sm:text-3xl">
            <span className="sr-only">{t.summary.pointsLabel}: </span>
            {t.summary.points(fmt(summary.totalPoints))}
          </p>
        </div>

        {challenge && comparison ? (
          <DuelVersus friend={challenge.friend} you={comparison.you} outcome={comparison.outcome} />
        ) : (
          <div className="flex flex-col gap-md">
            <DuelTiles tiles={summary.tiles} label={t.summary.gridLabel} />
            <p aria-hidden="true" className="text-sm text-text-muted">{t.summary.legend}</p>
          </div>
        )}

        <div className="flex flex-col gap-sm rounded-xl bg-surface p-xl shadow-md">
          <p className="text-sm font-bold uppercase tracking-wide text-primary">{t.summary.blindSpotHeading}</p>
          <p className="font-display text-3xl font-extrabold leading-tight sm:text-4xl">
            {summary.blindSpot ? t.blindSpots[summary.blindSpot] : t.summary.noBlindSpot}
          </p>
        </div>

        <div className="flex flex-col gap-sm">
          <div className="flex flex-col gap-sm sm:flex-row">
            <Button variant="secondary" size="lg" onClick={onCopyChallenge} className="text-base sm:flex-1">
              {t.summary.copyChallenge(summary.right, summary.rounds)}
            </Button>
            <button type="button" onClick={onShare} disabled={shareStatus === 'sharing'} className={cx(WHITE_BUTTON, 'text-base')}>
              {t.summary.share}
            </button>
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
          <p className="text-sm text-text-muted">{t.summary.nextIn(summary.nextIn.hours, summary.nextIn.minutes)}</p>
        </div>
      </div>

      <section className="flex flex-col gap-lg rounded-xl bg-primary p-xl text-on-primary shadow-lg sm:p-2xl">
        <Art name="empty-plot" className="mx-auto w-full max-w-[calc(var(--spacing-3xl)*9)]" />
        <p className="text-sm font-bold uppercase tracking-wide">{t.summary.ctaEyebrow}</p>
        <p className="font-display text-4xl font-extrabold leading-display tracking-tight sm:text-display">{t.summary.ctaLead}</p>
        <a href={guessOwnHref} onClick={onGuessOwn} className={cx(WHITE_BUTTON, 'w-full text-xl')}>
          {t.summary.cta}
        </a>
      </section>
    </div>
  );
}
