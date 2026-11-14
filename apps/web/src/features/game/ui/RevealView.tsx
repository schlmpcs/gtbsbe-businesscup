import { useId } from 'react';
import { common, game as t } from '@/copy';
import { Button, Card, EstimateTag, Money, SourceNote, Sticker, buttonClassName, cx, formatMoney, formatRate } from '@/ui-kit';
import type { RevealVM } from '../model/types';
import { ClueFacts } from './ClueFacts';
import { RangeScale } from './RangeScale';

export type RevealViewProps = {
  reveal: RevealVM;
  onNext: () => void;
  /** "Home 3 of 5" for the eyebrow (null when not shown). */
  progressLabel?: string | null;
  large?: boolean;
};

/** Color bar on top of each category tile, in breakdown order (chart palette tokens). */
const BAR = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5', 'bg-chart-6'] as const;
/** Alternating slight tilts, from sm up (decorative only). */
const TILT = ['sm:-rotate-1', 'sm:rotate-1', 'sm:rotate-[0.5deg]', 'sm:-rotate-[0.5deg]'] as const;

/** S3: the answer huge on the orange arena, your guess in a tilted tile, the cost tiles with sources, next home. */
export function RevealView({ reveal, onNext, progressLabel = null, large = false }: RevealViewProps) {
  const headingId = useId();
  const breakdownId = useId();
  const { total, result } = reveal;
  const fmt = (n: number) => n.toLocaleString('en-US');

  return (
    <div className="flex flex-col gap-2xl">
      {/* The arena: own surface (not Card arena) so the white guess tile inside keeps dark text. */}
      <section
        aria-labelledby={headingId}
        className={cx(
          'grid grid-cols-1 gap-2xl rounded-xl bg-primary p-xl text-on-primary shadow-lg sm:p-2xl lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-center',
          large && 'ring-4 ring-on-primary',
        )}
      >
        <div className="flex min-w-0 flex-col gap-md">
          <p className="text-sm font-bold uppercase tracking-wide">
            {progressLabel ? (
              <>
                <span>{progressLabel}</span> · {reveal.card.metro}
              </>
            ) : (
              reveal.card.metro
            )}
          </p>
          <h2 id={headingId} className="font-display text-3xl font-extrabold leading-tight sm:text-4xl">
            {t.reveal.costsHeading}
          </h2>
          <p className="flex flex-wrap items-end gap-x-md">
            <Money
              value={total.mid}
              className="font-display text-display font-extrabold leading-display sm:text-[length:calc(var(--text-display)*1.5)] xl:text-[length:calc(var(--text-display)*2.4)]"
            />
            <span className="pb-sm text-xl font-medium">{t.reveal.perMonth}</span>
          </p>
          <p className="text-base text-on-primary/80">
            {t.reveal.range(formatMoney(total.low), formatMoney(total.high))}
          </p>
          {reveal.surprise && (
            <p className={cx('font-semibold', large ? 'text-2xl' : 'text-xl')}>
              {t.reveal.surprise(common.categories[reveal.surprise.category], formatRate(reveal.surprise.share, 0))}
            </p>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-md">
          <div className="flex flex-col gap-md rounded-xl bg-surface p-xl text-text shadow-lg lg:rotate-2">
            <div className="flex flex-wrap items-center gap-sm">
              <Sticker tone="positive" tilt={-4} className="text-sm">
                {t.reveal.pointsSticker(fmt(result.points))}
              </Sticker>
              <Sticker tone="ink" tilt={3} className="text-sm">
                {reveal.direction === 'in' ? t.reveal.inRangeSticker : t.reveal.missed[reveal.direction](formatMoney(reveal.missBy))}
              </Sticker>
            </div>
            <div className="flex flex-wrap items-end justify-between gap-x-md">
              <span className="text-sm text-text-muted">{t.reveal.yourGuess}</span>
              <Money value={reveal.guess} className="font-display text-4xl font-extrabold leading-tight" />
            </div>
            <RangeScale reveal={reveal} />
            <p className="text-xs text-text-muted">
              {t.reveal.pointsDetail(fmt(result.basePoints), formatRate(result.multiplier), reveal.cluesOpened.length)}
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby={breakdownId} className="flex flex-col gap-lg">
        <h2 id={breakdownId} className="font-display text-3xl font-extrabold leading-tight">
          {t.reveal.breakdownHeading}
        </h2>
        <ul aria-label={t.reveal.breakdownLabel} className="grid grid-cols-1 gap-lg sm:grid-cols-2 lg:grid-cols-4">
          {reveal.categories.map((c, i) => (
            <li
              key={c.category}
              className={cx(
                'flex min-w-0 flex-col gap-sm rounded-xl bg-surface p-lg text-text shadow-md',
                TILT[i % TILT.length],
                reveal.surprise?.category === c.category && 'ring-2 ring-primary',
              )}
            >
              <span aria-hidden="true" className={cx('h-sm w-full rounded-full', BAR[i % BAR.length])} />
              <div className="flex items-baseline justify-between gap-md">
                <span className="font-semibold">{common.categories[c.category]}</span>
                <span className="text-sm text-text-muted tabular-nums">{formatRate(c.share, 0)}</span>
              </div>
              <Money value={c.amount} className="font-display text-4xl font-extrabold leading-tight" />
              <p className="flex flex-wrap items-center gap-xs text-xs text-text-muted">
                {c.sources.map((s) => t.reveal.sourceShort(s.name, s.year)).join('; ')}
                {c.isEstimate && <EstimateTag />}
              </p>
            </li>
          ))}
        </ul>
        <Card tone="default" className="text-sm text-text">
          <details>
            <summary className="cursor-pointer font-medium">{t.reveal.sourcesHeading}</summary>
            <dl className="mt-sm flex flex-col gap-sm">
              {reveal.categories.map((c) => (
                <div key={c.category} className="flex flex-col">
                  <dt className="font-medium">{common.categories[c.category]}</dt>
                  {c.sources.map((s, i) => (
                    <dd key={`${s.name}-${s.year}-${i}`}>
                      <SourceNote source={s} />
                    </dd>
                  ))}
                </div>
              ))}
            </dl>
          </details>
        </Card>
      </section>

      <Card title={t.reveal.whoLivedHere} headingLevel={2} className="text-text">
        <ClueFacts facts={reveal.cardFacts} />
      </Card>

      <div className="flex flex-col-reverse gap-md sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-sm">
          {reveal.shareImage && (
            <>
              <a
                href={reveal.shareImage.story}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClassName({ variant: 'ghost' })}
              >
                {t.reveal.shareCard}
              </a>
              <a
                href={reveal.shareImage.square}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClassName({ variant: 'ghost' })}
              >
                {t.reveal.shareCardSquare}
              </a>
            </>
          )}
        </div>
        <Button
          variant={large ? 'dark' : 'primary'}
          size="lg"
          onClick={onNext}
          className={cx('w-full sm:w-auto sm:min-w-[calc(var(--spacing-3xl)*7)]', large && 'text-2xl')}
        >
          {reveal.isLastCard ? t.reveal.finish : t.reveal.next}
        </Button>
      </div>
    </div>
  );
}
