// Chapter 1, "You don't know what other people spend": three practice rounds of "Which life costs
// more?" (labelled practice: not the daily five, nothing scored). Tap a life, put a number on it,
// Reveal: both monthly totals count up and their bars grow. After round 3: "You were off by X% on
// average" with a small per-round error strip. Every number comes from the view-model.
import type { CSSProperties } from 'react';
import { common, duel, onboarding } from '@/copy';
import { Art, Button, cx, formatMoney, formatRate, Slider, Sticker, Tag } from '@/ui-kit';
import type { PracticeCardVM, PracticeResultVM, PracticeSummaryVM, PracticeVM } from '../model/types';
import { Count } from './Count';

const t = onboarding.practice;
const BAR_COLORS = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4'] as const;

export type ChapterPracticeProps = {
  vm: PracticeVM;
  onDone: () => void;
  /** Link to the daily game (shown under the summary). */
  dailyHref: string;
};

export function ChapterPractice({ vm, onDone, dailyHref }: ChapterPracticeProps) {
  if (vm.phase === 'summary' && vm.summary) return <Summary summary={vm.summary} onDone={onDone} onAgain={vm.restart} dailyHref={dailyHref} />;
  const revealed = vm.phase === 'revealed';
  const picked = vm.cards.find((c) => c.picked) ?? null;
  return (
    <div className="flex flex-col gap-lg" data-testid="practice">
      <div className="flex flex-wrap items-center gap-sm">
        <Sticker tone="ink" tilt={-3} className="text-sm">
          {t.label}
        </Sticker>
        <p className="text-sm font-semibold tabular-nums">{t.round(vm.round, vm.rounds)}</p>
        <p className="w-full text-xs text-text-muted sm:w-auto">{t.note}</p>
      </div>
      <h2 className="font-display text-2xl font-extrabold sm:text-3xl">{t.question}</h2>

      {/* Keyed by round: each new pair enters. */}
      <div key={vm.round} className="grid grid-cols-1 gap-md sm:grid-cols-2">
        {vm.cards.map((card, i) => (
          <PracticeCard key={card.letter} card={card} index={i} revealed={revealed} onPick={revealed ? undefined : () => vm.pick(card.letter)} />
        ))}
      </div>

      {vm.phase === 'guess' && picked && (
        <div className="ob-enter flex flex-col gap-md rounded-xl bg-surface p-lg shadow-md">
          <p className="font-display text-4xl font-extrabold tabular-nums text-primary" aria-hidden="true">
            {formatMoney(vm.guess.value)}
          </p>
          <Slider
            label={t.guessLabel(picked.letter)}
            value={vm.guess.value}
            min={vm.guess.min}
            max={vm.guess.max}
            step={vm.guess.step}
            scale="log"
            formatValue={(v) => formatMoney(v)}
            onValueChange={vm.setGuess}
          />
          <Button size="lg" onClick={vm.reveal} className="ob-press self-stretch sm:self-end">
            {t.reveal}
          </Button>
        </div>
      )}

      {revealed && vm.result && <RoundResult result={vm.result} last={vm.round >= vm.rounds} onNext={vm.next} />}
    </div>
  );
}

function PracticeCard({
  card,
  index,
  revealed,
  onPick,
}: {
  card: PracticeCardVM;
  index: number;
  revealed: boolean;
  onPick?: () => void;
}) {
  return (
    <article
      aria-label={`${card.household}, ${card.metro}`}
      data-letter={card.letter}
      data-picked={card.picked ? 'true' : 'false'}
      style={{ '--ob-delay': `${index * 90}ms` } as CSSProperties}
      className={cx(
        'ob-enter relative flex flex-col gap-sm rounded-xl bg-surface p-lg shadow-md transition-shadow',
        card.picked && 'ring-4 ring-primary ring-inset',
        revealed && card.costlier && 'shadow-lg',
      )}
    >
      {onPick && (
        <button
          type="button"
          onClick={onPick}
          aria-pressed={card.picked}
          aria-label={t.pickLabel(card.letter, card.household, card.metro)}
          className="ob-press absolute inset-0 z-10 cursor-pointer rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
        />
      )}
      <div className="flex items-start justify-between gap-sm">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink font-display text-lg font-extrabold text-on-primary">
          {card.letter}
        </span>
        <div className="flex flex-wrap justify-end gap-xs">
          {card.picked && <Tag className="bg-primary-soft text-primary">{t.youPicked}</Tag>}
          {revealed && card.costlier && (
            <Sticker tone="primary" tilt={4} className="ob-pop text-xs">
              {t.costlier}
            </Sticker>
          )}
        </div>
      </div>
      <Art name={card.art} className="mx-auto w-1/2 max-w-40" imgClassName="aspect-square" loading="eager" />
      <div className="flex min-w-0 flex-col gap-xs">
        <h3 className="font-display text-xl font-extrabold leading-tight">{card.household}</h3>
        <p className="text-sm text-text-muted">
          {card.metro} · {t.composite}
        </p>
        {card.caption && <p className="text-sm">{card.caption}</p>}
        <ul aria-label={duel.card.factsLabel} className="grid grid-cols-2 gap-xs pt-xs">
          {card.facts.map((g) => (
            <li key={g.group} className="flex min-w-0 flex-col rounded-md bg-bg px-sm py-xs text-xs">
              <span className="font-bold uppercase tracking-wide text-text-muted">{duel.facts.groups[g.group]}</span>
              <span className="font-semibold text-text">{g.items[0]}</span>
              <span className="text-text-muted">{g.items[1]}</span>
            </li>
          ))}
        </ul>
      </div>
      {revealed && card.total !== null && (
        <div className="flex flex-col gap-sm border-t border-border pt-sm" data-testid={`practice-total-${card.letter}`}>
          <p className="flex items-baseline gap-xs">
            <Count
              value={card.total}
              format={(v) => formatMoney(v)}
              className={cx('font-display text-3xl font-extrabold', card.costlier && 'text-primary')}
              data-testid={`practice-total-value-${card.letter}`}
            />
            <span className="text-sm text-text-muted">{t.perMonth}</span>
          </p>
          <span className="block h-3 w-full overflow-hidden rounded-full bg-bg" aria-hidden="true">
            <span
              className={cx('ob-grow-x block h-full rounded-full', card.costlier ? 'bg-primary' : 'bg-ink')}
              style={{ width: `${(card.totalShare ?? 0) * 100}%` }}
            />
          </span>
          <ul aria-label={t.barsLabel(card.letter)} className="flex flex-col gap-xs">
            {card.bars.map((b, i) => (
              <li key={b.category} className="grid grid-cols-[7rem_1fr_auto] items-center gap-sm text-xs">
                <span className="truncate text-text-muted">{common.categories[b.category]}</span>
                <span className="block h-2 overflow-hidden rounded-full bg-bg" aria-hidden="true">
                  <span
                    className={cx('ob-grow-x block h-full rounded-full', BAR_COLORS[i % BAR_COLORS.length])}
                    style={{ width: `${b.share * 100}%`, '--ob-delay': `${200 + i * 80}ms` } as CSSProperties}
                  />
                </span>
                <span className="font-semibold tabular-nums">{formatMoney(b.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

function RoundResult({ result: r, last, onNext }: { result: PracticeResultVM; last: boolean; onNext: () => void }) {
  const err = formatRate(r.error, 0);
  return (
    <div className="ob-enter flex flex-col gap-md rounded-xl bg-ink p-lg text-on-primary shadow-md sm:flex-row sm:items-center sm:justify-between" data-testid="practice-result" role="status">
      <div className="flex min-w-0 flex-col gap-xs">
        <p className="font-display text-2xl font-extrabold">{r.correct ? t.right : t.wrong}</p>
        <p className="text-base tabular-nums">
          {Math.round(r.error * 100) === 0 ? t.spotOn(formatMoney(r.guess)) : t.yourNumber(formatMoney(r.guess), formatMoney(r.actual), err)}
        </p>
        <p className="text-sm text-on-primary/70">{t.gap(formatMoney(r.gap), common.categories[r.decidedBy])}</p>
      </div>
      <Button size="lg" onClick={onNext} className="ob-press shrink-0">
        {last ? t.finish : t.next}
      </Button>
    </div>
  );
}

function Summary({
  summary: s,
  onDone,
  onAgain,
  dailyHref,
}: {
  summary: PracticeSummaryVM;
  onDone: () => void;
  onAgain: () => void;
  dailyHref: string;
}) {
  const worst = Math.max(...s.rounds.map((r) => r.error), 0.0001);
  return (
    <div className="flex flex-col gap-xl" data-testid="practice-summary">
      <div className="ob-pop flex flex-col gap-md rounded-xl bg-ink p-xl text-on-primary shadow-md">
        <p className="font-display text-4xl font-extrabold leading-tight sm:text-5xl" data-testid="practice-average" data-value={formatRate(s.averageError, 0)}>
          {t.summaryTitle(formatRate(s.averageError, 0))}
        </p>
        <p className="text-lg">
          {t.summaryRight(s.right, s.rounds.length)} {s.mostlyLow ? t.summaryLow : t.summaryHigh}
        </p>
        <ol aria-label={t.stripLabel} className="grid grid-cols-3 gap-sm pt-sm">
          {s.rounds.map((r, i) => (
            <li key={r.round} className="flex flex-col gap-xs">
              <span className="flex h-16 items-end overflow-hidden rounded-md bg-on-primary/10" aria-hidden="true">
                <span
                  className={cx('ob-enter block w-full rounded-md', r.low ? 'bg-primary' : 'bg-chart-2')}
                  style={{ height: `${Math.max(6, (r.error / worst) * 100)}%`, '--ob-delay': `${i * 120}ms` } as CSSProperties}
                />
              </span>
              <span className="text-xs tabular-nums">{t.stripRound(r.round, formatRate(r.error, 0))}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="flex flex-col-reverse items-stretch gap-md sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-xs">
          <button type="button" onClick={onAgain} className="min-h-11 text-left text-base font-semibold hover:text-primary">
            {t.again}
          </button>
          <a href={dailyHref} className="text-sm text-text-muted underline hover:text-text">
            {t.daily}
          </a>
        </div>
        <Button size="lg" onClick={onDone} className="ob-press">
          {t.onward}
        </Button>
      </div>
    </div>
  );
}
