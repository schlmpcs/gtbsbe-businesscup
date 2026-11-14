import { common, game as t } from '@/copy';
import {
  BarBreakdown, Button, Card, Money, SourceNote, Stat, cx, formatMoney, formatRate, type BarBreakdownItem,
} from '@/ui-kit';
import type { RevealVM } from '../model/types';
import { ClueFacts } from './ClueFacts';
import { RangeScale } from './RangeScale';

export type RevealViewProps = {
  reveal: RevealVM;
  onNext: () => void;
  large?: boolean;
};

const DIRECTION_TONE = { low: 'text-warning', in: 'text-positive', high: 'text-warning' } as const;

/** S3: the answer, your guess on the range, points, the cost bars with sources, and the next home. */
export function RevealView({ reveal, onNext, large = false }: RevealViewProps) {
  const { total, result } = reveal;
  const bars: BarBreakdownItem[] = reveal.categories.map((c) => ({
    id: c.category,
    label: common.categories[c.category],
    amount: c.amount,
    isEstimate: c.isEstimate,
  }));

  return (
    <div className="flex flex-col gap-lg">
      <Card tone="arena">
        <div className="flex flex-col gap-lg">
          <h2 className={cx('font-bold leading-tight', large ? 'text-display' : 'text-3xl', DIRECTION_TONE[reveal.direction])}>
            {t.reveal.direction[reveal.direction]}
          </h2>
          <div className="grid grid-cols-1 gap-lg sm:grid-cols-3">
            <Stat
              label={t.reveal.actualLabel}
              value={<Money value={total.mid} />}
              hint={t.reveal.range(formatMoney(total.low), formatMoney(total.high))}
              size={large ? 'display' : 'lg'}
            />
            <Stat label={t.reveal.yourGuess} value={<Money value={reveal.guess} />} size={large ? 'lg' : 'md'} />
            <Stat
              label={t.reveal.points}
              value={t.reveal.pointsOf(result.points.toLocaleString('en-US'), reveal.maxPoints.toLocaleString('en-US'))}
              hint={t.reveal.pointsDetail(
                result.basePoints.toLocaleString('en-US'),
                formatRate(result.multiplier),
                reveal.cluesOpened.length,
              )}
              size={large ? 'lg' : 'md'}
            />
          </div>
          <RangeScale reveal={reveal} />
          {reveal.surprise && (
            <p className={cx('font-semibold', large ? 'text-2xl' : 'text-lg')}>
              {t.reveal.surprise(common.categories[reveal.surprise.category], formatRate(reveal.surprise.share, 0))}
            </p>
          )}
        </div>
      </Card>

      <Card title={t.reveal.breakdownHeading}>
        <BarBreakdown
          label={t.reveal.breakdownLabel}
          items={bars}
          total={total.mid}
          highlightId={reveal.surprise?.category}
        />
        <details className="mt-lg text-sm">
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

      <Card title={t.reveal.whoLivedHere} headingLevel={2}>
        <p className="mb-sm text-text-muted">
          {reveal.card.metro} · {reveal.card.caption}
        </p>
        <ClueFacts facts={reveal.cardFacts} />
      </Card>

      {reveal.shareImage && (
        <p className="flex flex-wrap gap-md text-sm">
          <a href={reveal.shareImage.story} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            {t.reveal.shareCard}
          </a>
          <a href={reveal.shareImage.square} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            {t.reveal.shareCardSquare}
          </a>
        </p>
      )}

      <Button size="lg" fullWidth onClick={onNext} className={cx(large && 'text-2xl')}>
        {reveal.isLastCard ? t.reveal.finish : t.reveal.next}
      </Button>
    </div>
  );
}
