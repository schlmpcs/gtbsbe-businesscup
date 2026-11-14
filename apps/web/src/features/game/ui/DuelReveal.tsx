import { useId } from 'react';
import { common, duel as t } from '@/copy';
import { Button, SourceNote, cx, formatMoney, formatRate } from '@/ui-kit';
import type { DuelRevealVM } from '../model/types';
import { DuelIcon } from './DuelIcons';

/**
 * S3 top (Figma Design v3 reveal): the result sticker (green when right, white when not, never red),
 * the round line and the headline.
 */
export function DuelRevealHeader({ reveal, totalRounds }: { reveal: DuelRevealVM; totalRounds: number }) {
  return (
    <div className="flex flex-col items-center gap-md text-center">
      <p role="status">
        <span
          className={cx(
            'inline-flex items-center rounded-full px-lg py-sm text-sm font-bold uppercase tracking-wide shadow-md sm:text-base',
            reveal.correct ? 'bg-positive text-on-primary' : 'bg-surface text-text',
          )}
        >
          {reveal.correct ? t.reveal.right(reveal.points.toLocaleString('en-US')) : t.reveal.wrong}
        </span>
      </p>
      <p className="text-sm text-text-muted">{t.round(reveal.round, totalRounds)}</p>
      <h2 className="font-display text-4xl font-extrabold leading-display tracking-tight text-balance sm:text-display lg:text-[length:calc(var(--text-display)*1.3)]">
        {reveal.costlier ? t.reveal.headline(reveal.costlier, formatMoney(reveal.difference)) : t.reveal.same}
      </h2>
      <p className="text-base font-medium text-text-muted">
        {t.reveal.totals(formatMoney(reveal.totals.A), formatMoney(reveal.totals.B), reveal.choice)}
      </p>
    </div>
  );
}

/**
 * S3 ink band: what decided it (category, both amounts), the lesson, the crowd, and the next-round
 * button, so the way forward shows without scrolling.
 */
export function DuelRevealBand({ reveal, onNext }: { reveal: DuelRevealVM; onNext: () => void }) {
  const decidedId = useId();
  const { decidedBy } = reveal;
  return (
    <section
      aria-labelledby={decidedId}
      className="flex flex-col gap-lg rounded-xl bg-ink p-xl text-on-primary shadow-lg md:flex-row md:items-center md:gap-xl"
    >
      <DuelIcon name="bulb" className="hidden size-2xl shrink-0 text-primary md:block" />
      <div className="flex min-w-0 flex-1 flex-col gap-xs">
        <h3 id={decidedId} className="font-display text-2xl font-extrabold leading-tight sm:text-3xl">
          {t.reveal.decidedLine(
            common.categories[decidedBy.category],
            formatMoney(decidedBy.amount),
            formatMoney(decidedBy.otherAmount),
          )}
        </h3>
        <p className="text-base text-on-primary/85">{reveal.lesson}</p>
        <p className="text-sm text-on-primary/70">
          {reveal.crowd
            ? t.reveal.crowd(formatRate(reveal.crowd.share, 0), reveal.crowd.letter, reveal.crowd.total.toLocaleString('en-US'))
            : t.reveal.crowdNone}
        </p>
      </div>
      <Button size="lg" onClick={onNext} className="w-full shrink-0 shadow-lg md:w-auto">
        {reveal.isLastRound ? t.reveal.finish : t.reveal.next}
      </Button>
    </section>
  );
}

/** How many sources the always-visible line names before "+ N more". */
const VISIBLE_SOURCES = 2;

/**
 * S3 under the band: a visible "Prices from" line naming the first sources (linked), then every
 * source behind both breakdowns by category and how the crowd line is counted, one tap away (the
 * page footer carries the disclaimer).
 */
export function DuelReveal({ reveal }: { reveal: DuelRevealVM }) {
  const shown = reveal.allSources.slice(0, VISIBLE_SOURCES);
  const more = reveal.allSources.length - shown.length;
  return (
    <div className="flex flex-col items-center gap-xs text-center text-sm text-text-muted">
      {shown.length > 0 && (
        <p data-testid="duel-sources-line">
          {t.reveal.pricesFrom}{' '}
          {shown.map((s, i) => (
            <span key={`${s.name}-${s.year}`}>
              {i > 0 && ' · '}
              {s.url ? (
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                  {s.name}
                </a>
              ) : (
                s.name
              )}
              {`, ${s.year}`}
            </span>
          ))}
          {more > 0 && ` ${t.reveal.moreSources(more)}`}
        </p>
      )}
      <details className="w-full max-w-(--container-2xl)">
        <summary className="inline-flex min-h-3xl cursor-pointer items-center justify-center px-md font-medium text-text underline underline-offset-2">
          {t.reveal.allSources(reveal.allSources.length)}
        </summary>
        <dl className="mt-sm flex flex-col gap-sm rounded-xl bg-surface p-lg text-left text-text shadow-md">
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
        <div className="mt-sm rounded-xl bg-surface p-lg text-left text-text shadow-md">
          <p className="font-medium">{t.reveal.crowdHowHeading}</p>
          <p>{t.reveal.crowdHow}</p>
        </div>
      </details>
    </div>
  );
}
