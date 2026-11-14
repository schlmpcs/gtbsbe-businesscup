import { useId } from 'react';
import { common, game as t } from '@/copy';
import { Button, Card, EstimateTag, Money, SourceNote, Sticker, buttonClassName, cx, formatMoney, formatRate } from '@/ui-kit';
import type { RevealVM } from '../model/types';
import { ClueFacts } from './ClueFacts';
import { RangeScale } from './RangeScale';

export type RevealViewProps = {
  reveal: RevealVM;
  onNext: () => void;
  /** "Home 3 of 5" for the line under the result sticker (null when not shown). */
  progressLabel?: string | null;
  large?: boolean;
};

/** Color bar on top of each category tile, in breakdown order (chart palette tokens). */
const BAR = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5', 'bg-chart-6'] as const;

/**
 * S3 (Design v3): centered result sticker and the real monthly cost in giant type; an ink band with
 * what decided it and the next-home button (visible without scrolling); then your guess on the
 * range, the category tiles with sources, and who lived here.
 */
export function RevealView({ reveal, onNext, progressLabel = null, large = false }: RevealViewProps) {
  const headingId = useId();
  const bandId = useId();
  const breakdownId = useId();
  const { total, result } = reveal;
  const fmt = (n: number) => n.toLocaleString('en-US');
  const good = reveal.direction === 'in';
  const muted = large ? 'text-on-primary' : 'text-text-muted';

  // The ink band names the biggest category (the view-model's surprise line) with its monthly amount.
  const surprise = reveal.surprise;
  const surpriseName = surprise ? common.categories[surprise.category] : null;
  const surpriseAmount = surprise ? reveal.categories.find((c) => c.category === surprise.category)?.amount : undefined;
  const bandTitle =
    surprise && surpriseName
      ? surpriseAmount !== undefined
        ? t.reveal.decided(surpriseName, formatMoney(surpriseAmount))
        : t.reveal.surprise(surpriseName, formatRate(surprise.share, 0))
      : t.reveal.decidedFallback;

  return (
    <div className="flex flex-col gap-2xl">
      <section aria-labelledby={headingId} className="flex flex-col items-center gap-md text-center">
        <Sticker tone={good ? 'positive' : 'white'} tilt={-3} className={large ? 'text-lg' : 'text-sm'}>
          {good ? t.reveal.pointsSticker(fmt(result.points)) : t.reveal.pointsNeutral(fmt(result.points))}
        </Sticker>
        <p className={cx('text-sm font-medium', muted)}>
          {progressLabel ? (
            <>
              <span>{progressLabel}</span> · {reveal.card.metro}
            </>
          ) : (
            reveal.card.metro
          )}
        </p>
        <h2
          id={headingId}
          className={cx(
            'font-display font-extrabold leading-display text-balance',
            large ? 'text-display sm:text-[length:calc(var(--text-display)*1.5)]' : 'text-4xl sm:text-display',
          )}
        >
          {t.reveal.costsHeading}{' '}
          <Money value={total.mid} className={cx('tabular-nums', large ? 'text-ink' : 'text-primary')} />{' '}
          {t.reveal.perMonth}
        </h2>
        <p className={cx('text-base', muted)}>{t.reveal.range(formatMoney(total.low), formatMoney(total.high))}</p>
      </section>

      {/* The ink band: what decided it, and the next-home CTA inside it. */}
      <section
        aria-labelledby={bandId}
        className="flex flex-col gap-lg rounded-xl bg-ink p-xl text-on-primary shadow-lg sm:flex-row sm:items-center sm:justify-between sm:p-2xl"
      >
        <div className="flex min-w-0 items-start gap-md">
          <span aria-hidden="true" className="text-2xl leading-tight">
            💡
          </span>
          <div className="flex min-w-0 flex-col gap-xs">
            <h2 id={bandId} className={cx('font-display font-extrabold leading-tight', large ? 'text-3xl' : 'text-2xl')}>
              {bandTitle}
            </h2>
            {surprise && surpriseName && surpriseAmount !== undefined && (
              <p className={cx('text-on-primary/80', large ? 'text-xl' : 'text-base')}>
                {t.reveal.surprise(surpriseName, formatRate(surprise.share, 0))}
              </p>
            )}
          </div>
        </div>
        <Button
          variant="primary"
          size="lg"
          onClick={onNext}
          className={cx('w-full shrink-0 sm:w-auto', large && 'text-2xl')}
        >
          {reveal.isLastCard ? t.reveal.finish : t.reveal.next}
        </Button>
      </section>

      <div className="grid grid-cols-1 gap-xl lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:items-start">
        {/* Your guess on the range. */}
        <div className="flex min-w-0 flex-col gap-md rounded-xl bg-surface p-xl text-text shadow-md">
          <div className="flex flex-wrap items-center gap-sm">
            <Sticker tone={good ? 'positive' : 'ink'}>
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

        <section aria-labelledby={breakdownId} className="flex min-w-0 flex-col gap-lg">
          <h2 id={breakdownId} className="font-display text-3xl font-extrabold leading-tight">
            {t.reveal.breakdownHeading}
          </h2>
          <ul aria-label={t.reveal.breakdownLabel} className="grid grid-cols-1 gap-md sm:grid-cols-2 xl:grid-cols-3">
            {reveal.categories.map((c, i) => (
              <li
                key={c.category}
                className={cx(
                  'flex min-w-0 flex-col gap-sm rounded-xl bg-surface p-lg text-text shadow-md',
                  surprise?.category === c.category && 'ring-2 ring-primary',
                )}
              >
                <span aria-hidden="true" className={cx('h-xs w-full rounded-full', BAR[i % BAR.length])} />
                <div className="flex items-baseline justify-between gap-md">
                  <span className="font-semibold">{common.categories[c.category]}</span>
                  <span className="text-sm text-text-muted tabular-nums">{formatRate(c.share, 0)}</span>
                </div>
                <Money value={c.amount} className="font-display text-3xl font-extrabold leading-tight" />
                <p className="flex flex-wrap items-center gap-xs text-xs text-text-muted">
                  {c.sources.map((s) => t.reveal.sourceShort(s.name, s.year)).join('; ')}
                  {c.isEstimate && <EstimateTag />}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-xl lg:grid-cols-2 lg:items-start">
        <Card title={t.reveal.whoLivedHere} headingLevel={2} className="text-text">
          <ClueFacts facts={reveal.cardFacts} />
        </Card>
        <Card className="text-sm text-text">
          <details>
            <summary className="cursor-pointer font-semibold text-primary">{t.reveal.sourcesHeading}</summary>
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
      </div>

      {reveal.shareImage && (
        <div className="flex flex-wrap justify-center gap-sm">
          <a
            href={reveal.shareImage.story}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClassName({ variant: large ? 'dark' : 'secondary' })}
          >
            {t.reveal.shareCard}
          </a>
          <a
            href={reveal.shareImage.square}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClassName({ variant: large ? 'dark' : 'secondary' })}
          >
            {t.reveal.shareCardSquare}
          </a>
        </div>
      )}
    </div>
  );
}
