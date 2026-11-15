import { useId } from 'react';
import { common, duel as t } from '@/copy';
import { Button, EstimateTag, SourceNote, Sticker, cx, formatMoney, formatRate } from '@/ui-kit';
import { CountUp, MOTION } from '@/ui-kit/reports';
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

/** The two lives' bar colors in the side-by-side panel (each bar also carries its letter). */
const LIFE_BAR = { A: 'bg-chart-1', B: 'bg-chart-5' } as const;

/** One life's bar in a category row: the letter, a bar on the round's shared scale, the amount. */
function CompareBar({ letter, amount, scale }: { letter: 'A' | 'B'; amount: number; scale: number }) {
  return (
    <div className="grid grid-cols-[1.25rem_1fr_auto] items-center gap-sm">
      <span className="text-xs font-bold text-text-muted">{letter}</span>
      <span className="block h-sm overflow-hidden rounded-full bg-surface-strong">
        <span
          className={cx('block h-full rounded-full', LIFE_BAR[letter], MOTION.growX)}
          style={{ width: `${Math.max(scale, 0) * 100}%` }}
        />
      </span>
      <span className="min-w-[4.5rem] text-right text-sm font-bold tabular-nums">{formatMoney(amount)}</span>
    </div>
  );
}

/**
 * S3 below the cards: both monthly totals (counting up), every category side by side with the one
 * that decided the round highlighted, the lesson, then every source behind both breakdowns and how
 * the crowd line is counted (the page footer carries the disclaimer). Amounts and bar lengths are the
 * view-model's (buildDuelCompare); this only lays them out.
 */
export function DuelReveal({ reveal }: { reveal: DuelRevealVM }) {
  const headingId = useId();
  return (
    <div className="flex flex-col items-center gap-lg">
      <section
        aria-labelledby={headingId}
        data-testid="duel-compare"
        className={cx('flex w-full max-w-(--container-4xl) flex-col gap-lg rounded-xl bg-surface p-lg text-left text-text shadow-md sm:p-xl', MOTION.rise)}
      >
        <header className="flex flex-col gap-xs">
          <h3 id={headingId} className="font-display text-2xl font-extrabold leading-tight">{t.reveal.compareHeading}</h3>
          <p className="text-sm text-text-muted">{t.reveal.compareSub}</p>
        </header>

        <dl className="grid grid-cols-2 gap-md">
          {(['A', 'B'] as const).map((letter) => (
            <div
              key={letter}
              className={cx('flex flex-col gap-xs rounded-lg p-md', reveal.costlier === letter ? 'bg-primary-soft' : 'bg-surface-strong')}
            >
              <dt className="inline-flex items-center gap-xs text-sm font-semibold text-text-muted">
                <span aria-hidden="true" className={cx('size-sm rounded-full', LIFE_BAR[letter])} />
                {t.reveal.totalLabel(letter)}
              </dt>
              <dd
                className={cx(
                  'font-display text-3xl font-extrabold tabular-nums leading-tight sm:text-4xl',
                  reveal.costlier === letter ? 'text-primary' : 'text-text',
                )}
              >
                <CountUp value={reveal.totals[letter]} format={(v) => formatMoney(v)} />
              </dd>
            </div>
          ))}
        </dl>

        <ul aria-label={t.reveal.compareLabel} className="flex flex-col gap-sm">
          {reveal.categories.map((row) => (
              <li
                key={row.category}
                className={cx(
                  'grid grid-cols-1 gap-xs rounded-lg p-sm sm:grid-cols-[9rem_1fr] sm:items-center sm:gap-md',
                  row.decided && 'bg-primary-soft ring-2 ring-inset ring-primary',
                )}
              >
                <span className="flex flex-wrap items-center gap-xs text-sm font-semibold">
                  {common.categories[row.category]}
                  <span className="sr-only">{t.reveal.compareRow(formatMoney(row.A), formatMoney(row.B))}</span>
                  {row.isEstimate && <EstimateTag />}
                </span>
                <div aria-hidden="true" className="flex min-w-0 flex-col gap-xs">
                  <CompareBar letter="A" amount={row.A} scale={row.scaleA} />
                  <CompareBar letter="B" amount={row.B} scale={row.scaleB} />
                </div>
                {row.decided && (
                  <span className="sm:col-start-2">
                    <Sticker tone="primary" className="text-xs">{t.reveal.decidedTag}</Sticker>
                  </span>
                )}
              </li>
          ))}
        </ul>

      </section>

      <details className="w-full max-w-(--container-2xl) text-center text-sm text-text-muted">
        <summary className="cursor-pointer font-medium text-text">{t.reveal.sources}</summary>
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
