'use client';

// S16 Leaderboard (design preview). Spec: docs/design/USER-JOURNEY.md → After the cut line. Made-up
// handles, your row pinned to the bottom of the screen, a countdown to the next set, no prizes.
import { useState } from 'react';
import { previewA } from '@/copy';
import { Button, buttonClassName, cx } from '@/ui-kit';
import type { LeaderboardPreviewProps, LeaderboardRow } from '../model/types';
import { Pill, PreviewHeader, PreviewMain, PreviewStatus } from './shared';

const t = previewA.leaderboard;
const fmt = (n: number) => n.toLocaleString('en-US');

function Row({ row, rounds }: { row: LeaderboardRow; rounds: number }) {
  return (
    <div
      className={cx(
        'grid grid-cols-[2.5rem_minmax(0,1fr)_2.25rem_3.75rem] items-center gap-sm px-md py-md tabular-nums',
        row.you && 'rounded-xl bg-ink text-on-primary shadow-lg',
      )}
    >
      <span className={cx('font-display text-xl font-extrabold', row.rank <= 3 && !row.you && 'text-primary')}>{row.rank}</span>
      <span className="flex min-w-0 flex-col items-start gap-xs">
        <span className="max-w-full truncate font-semibold">{row.handle}</span>
        {row.you && <Pill tone="soft">{t.you}</Pill>}
      </span>
      <span className="text-right text-sm">{t.rightValue(row.right, rounds)}</span>
      <span className="text-right font-bold">{fmt(row.points)}</span>
    </div>
  );
}

export function LeaderboardPreview({ dateLabel, rounds, countdown, top, you, playHref }: LeaderboardPreviewProps) {
  const [shared, setShared] = useState(false);
  return (
    <PreviewMain narrow>
      <PreviewHeader eyebrow={t.eyebrow(dateLabel)} title={t.title} intro={t.intro} />
      <div className="flex flex-wrap items-center gap-sm">
        <Pill tone="ink" className="text-sm">
          <span data-testid="countdown">{t.countdown(countdown)}</span>
        </Pill>
        <Pill tone="outline" className="text-sm">
          {t.noPrizes}
        </Pill>
      </div>

      <div className="rounded-xl bg-surface p-sm shadow-md sm:p-md">
        <div
          aria-hidden="true"
          className="grid grid-cols-[2.5rem_minmax(0,1fr)_2.25rem_3.75rem] gap-sm border-b border-border px-md pb-sm text-xs text-text-muted"
        >
          <span>{t.rank}</span>
          <span>{t.player}</span>
          <span className="text-right">{t.right}</span>
          <span className="text-right">{t.points}</span>
        </div>
        <ol aria-label={t.listLabel} className="flex flex-col divide-y divide-border" data-testid="leaderboard-top">
          {top.map((row) => (
            <li key={row.rank}>
              <Row row={row} rounds={rounds} />
            </li>
          ))}
        </ol>
      </div>

      {/* Your row, pinned to the bottom of the screen while the board scrolls. */}
      <section aria-label={t.yourRow} data-testid="leaderboard-you" className="sticky bottom-md z-10">
        <Row row={you} rounds={rounds} />
      </section>

      <div className="flex flex-col gap-sm sm:flex-row">
        <Button variant="secondary" size="lg" onClick={() => setShared(true)} className="sm:flex-1">
          {t.share}
        </Button>
        <a href={playHref} className={cx(buttonClassName({ size: 'lg' }), 'sm:flex-1')}>
          {t.play}
        </a>
      </div>
      <PreviewStatus>{shared ? t.shared : null}</PreviewStatus>
    </PreviewMain>
  );
}
