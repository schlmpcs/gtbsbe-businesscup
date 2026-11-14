import { useId } from 'react';
import { common, duel as t } from '@/copy';
import { Card, SourceNote, cx, formatMoney, formatRate } from '@/ui-kit';
import type { DuelRevealVM } from '../model/types';
import { CATEGORY_COLOR } from './CategoryBar';

/** S3 top: the result pill (green when right, neutral gray when not, never red) and the headline. */
export function DuelRevealHeader({ reveal }: { reveal: DuelRevealVM }) {
  return (
    <div className="flex flex-col items-center gap-md text-center">
      <p
        role="status"
        className={cx(
          'inline-flex items-center rounded-full px-lg py-sm text-base font-bold',
          reveal.correct ? 'bg-positive text-on-primary' : 'bg-surface-strong text-text',
        )}
      >
        {reveal.correct ? t.reveal.right(reveal.points.toLocaleString('en-US')) : t.reveal.wrong}
      </p>
      <h2 className="font-display text-3xl font-extrabold leading-tight sm:text-4xl">
        {reveal.costlier ? t.reveal.headline(reveal.costlier, formatMoney(reveal.difference)) : t.reveal.same}
      </h2>
    </div>
  );
}

export type DuelRevealProps = {
  reveal: DuelRevealVM;
};

/** S3 below the cards: what decided it (with the lesson), the crowd and the sources. Next round sits under the headline. */
export function DuelReveal({ reveal }: DuelRevealProps) {
  const decidedId = useId();
  const { decidedBy } = reveal;
  const category = common.categories[decidedBy.category];
  return (
    <div className="flex flex-col gap-lg">
      <div className="grid grid-cols-1 gap-lg md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section aria-labelledby={decidedId} className="flex flex-col gap-sm rounded-xl bg-surface p-xl shadow-md">
          <h3 id={decidedId} className="text-sm font-bold text-text-muted">
            {t.reveal.decidedHeading}
          </h3>
          <p className="flex items-center gap-sm font-display text-2xl font-extrabold leading-tight">
            <span aria-hidden="true" className={cx('size-md shrink-0 rounded-full', CATEGORY_COLOR[decidedBy.category])} />
            {t.reveal.decidedLine(category, formatMoney(decidedBy.amount))}
          </p>
          <p className="text-sm text-text-muted">{t.reveal.decidedVs(decidedBy.otherLetter, formatMoney(decidedBy.otherAmount))}</p>
          <p className="text-lg font-semibold">{reveal.lesson}</p>
        </section>

        <Card tone="muted" className="flex flex-col justify-center gap-xs text-text">
          <p className="text-base font-semibold">
            {reveal.crowd
              ? t.reveal.crowd(formatRate(reveal.crowd.share, 0), reveal.crowd.letter, reveal.crowd.total.toLocaleString('en-US'))
              : t.reveal.crowdNone}
          </p>
          <p className="text-xs text-text-muted">{t.reveal.disclaimer}</p>
        </Card>
      </div>

      <Card tone="default" className="text-sm text-text">
        <details>
          <summary className="cursor-pointer font-medium">{t.reveal.sources}</summary>
          <dl className="mt-sm flex flex-col gap-sm">
            {reveal.sources.map((c) => (
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
  );
}
