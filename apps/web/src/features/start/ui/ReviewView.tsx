'use client';
import { common, start as t } from '@/copy';
import { AnimatedCounter } from '@/ui-kit/arc';
import { Button, cx, formatMoney } from '@/ui-kit';
import type { CostCategory, RevealVM, StartSource, StatementQuestionVM } from '../model/types';
import { ArrowIcon } from './icons';

export type ReviewViewProps = {
  source: StartSource;
  reveal: RevealVM;
  questions: StatementQuestionVM[];
  onAnswerCategory: (id: string, category: CostCategory) => void;
  onAnswerNone: (id: string) => void;
  onSkip: (id: string) => void;
  onFinish: () => void;
  onRestart: () => void;
};

/** Category colors from the chart tokens, in the order the reveal bar uses them. */
const CATEGORY_COLOR: Record<CostCategory, string> = {
  rentUtilities: 'bg-chart-1',
  childcare: 'bg-chart-2',
  car: 'bg-chart-3',
  groceries: 'bg-chart-4',
  eatingOut: 'bg-chart-5',
  subscriptions: 'bg-primary',
  debtPayments: 'bg-negative',
  other: 'bg-chart-6',
};

const pct = (x: number) => `${Math.round(x * 100)}%`;

function Question({ q, onAnswerCategory, onAnswerNone, onSkip }: {
  q: StatementQuestionVM;
  onAnswerCategory: (id: string, c: CostCategory) => void;
  onAnswerNone: (id: string) => void;
  onSkip: (id: string) => void;
}) {
  const text = q.kind === 'merchant'
    ? t.review.merchant(q.merchant ?? '')
    : q.kind === 'cash'
      ? t.review.cash
      : t.review.missing(common.categories[q.category ?? 'other']);
  const chosen = q.answer?.kind === 'category' ? q.answer.category : null;
  const answered = q.answer != null;
  return (
    <li className={cx('flex flex-col gap-sm rounded-lg border border-border bg-surface p-md transition-opacity', answered && 'opacity-70')}>
      <div className="flex items-baseline justify-between gap-md">
        <span className="text-sm font-semibold">{text}</span>
        {q.monthly > 0 ? <span className="shrink-0 text-xs tabular-nums text-text-muted">{formatMoney(q.monthly)}/mo</span> : null}
      </div>
      <div className="flex flex-wrap gap-xs">
        {q.options.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onAnswerCategory(q.id, c)}
            aria-pressed={chosen === c}
            className={cx('rounded-full border px-md py-xs text-xs font-semibold transition-colors',
              chosen === c ? 'border-primary bg-primary-soft text-text' : 'border-border hover:border-text-muted')}
          >
            {common.categories[c]}
          </button>
        ))}
        {q.kind === 'missing' ? (
          <button
            type="button"
            onClick={() => onAnswerNone(q.id)}
            aria-pressed={q.answer?.kind === 'amount'}
            className={cx('rounded-full border px-md py-xs text-xs font-semibold',
              q.answer?.kind === 'amount' ? 'border-primary bg-primary-soft' : 'border-border hover:border-text-muted')}
          >
            {t.review.none}
          </button>
        ) : null}
        <button type="button" onClick={() => onSkip(q.id)} className="px-sm py-xs text-xs font-semibold text-text-muted hover:text-text">
          {t.review.skip}
        </button>
      </div>
    </li>
  );
}

/** Step 4: the guess against the measured month, where it goes, and what the statement can't tell. */
export function ReviewView({ source, reveal, questions, onAnswerCategory, onAnswerNone, onSkip, onFinish, onRestart }: ReviewViewProps) {
  const r = reveal;
  const total = r.monthlySpend;
  const verdict = r.diff == null || r.guess == null
    ? null
    : Math.abs(r.diff) <= r.guess * 0.1
      ? { text: t.reveal.close, tone: 'positive' as const }
      : r.diff > 0
        ? { text: t.reveal.over(formatMoney(r.diff)), tone: 'primary' as const }
        : { text: t.reveal.under(formatMoney(-r.diff)), tone: 'positive' as const };

  return (
    <div className="grid grid-cols-1 gap-xl [&>*]:min-w-0 lg:grid-cols-[1.1fr_1fr] lg:gap-3xl">
      <section className="flex flex-col gap-lg">
        <span className="w-fit rounded-full bg-surface-strong px-md py-xs text-xs font-bold text-text-muted">{t.sourceLabel[source]}</span>

        <div className="flex flex-col gap-md rounded-xl bg-surface p-xl shadow-[0_20px_60px_rgb(29_27_24/0.08)]">
          {r.guess != null ? (
            <div className="flex items-baseline justify-between gap-md text-text-muted">
              <span className="text-sm font-semibold">{t.reveal.youGuessed}</span>
              <span className="font-display text-2xl font-bold tabular-nums line-through decoration-2">{formatMoney(r.guess)}</span>
            </div>
          ) : null}
          <div className="flex flex-col gap-xs">
            <span className="text-sm font-semibold text-text-muted">{r.guess != null ? t.reveal.actual : t.reveal.noGuess}</span>
            <span className="font-display text-6xl font-extrabold leading-none tracking-tight" data-testid="reveal-total">
              <AnimatedCounter value={Math.round(total)} prefix="$" />
            </span>
            <span className="text-xs text-text-muted">{t.reveal.perMonth} · {t.reveal.months(r.months)}</span>
          </div>
          {verdict ? (
            <span className={cx('w-fit rounded-full px-md py-xs text-sm font-bold',
              verdict.tone === 'primary' ? 'bg-primary text-on-primary' : 'bg-positive-soft text-positive')}>
              {verdict.text}
            </span>
          ) : null}

          {/* One stacked bar: where the month goes. */}
          <div className="mt-sm flex h-4 w-full overflow-hidden rounded-full bg-surface-strong" aria-hidden="true">
            {r.breakdown.map((b, i) => (
              <span
                key={b.category}
                className={cx('h-full origin-left opacity-0 [animation:fadeUp_.5s_ease_forwards]', CATEGORY_COLOR[b.category])}
                style={{ width: `${(b.amount / total) * 100}%`, animationDelay: `${300 + i * 80}ms` }}
              />
            ))}
          </div>
          {r.biggest ? (
            <p className="text-base font-semibold">{t.reveal.biggest(common.categories[r.biggest.category], pct(r.biggest.share))}</p>
          ) : null}

          {r.payIn != null && r.leftOver != null ? (
            <div className="grid grid-cols-2 gap-md border-t border-border pt-md">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-text-muted">{t.reveal.payIn}</span>
                <span className="font-display text-2xl font-bold tabular-nums">{formatMoney(r.payIn)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-text-muted">{r.leftOver >= 0 ? t.reveal.leftOver : t.reveal.shortfall}</span>
                <span className={cx('font-display text-2xl font-bold tabular-nums', r.leftOver >= 0 ? 'text-positive' : 'text-negative')}>
                  {formatMoney(Math.abs(r.leftOver))}
                </span>
              </div>
            </div>
          ) : null}
        </div>

        <ul className="flex flex-col gap-xs" aria-label={t.reveal.breakdownLabel}>
          {r.breakdown.map((b, i) => (
            <li
              key={b.category}
              className="flex items-center gap-md rounded-lg bg-surface px-md py-sm opacity-0 [animation:fadeUp_.4s_ease_forwards]"
              style={{ animationDelay: `${500 + i * 60}ms` }}
            >
              <span className={cx('size-3 shrink-0 rounded-full', CATEGORY_COLOR[b.category])} />
              <span className="flex-1 text-sm font-semibold">{common.categories[b.category]}</span>
              <span className="w-12 text-right text-xs tabular-nums text-text-muted">{pct(b.amount / total)}</span>
              <span className="w-20 text-right text-sm font-bold tabular-nums">{formatMoney(b.amount)}</span>
            </li>
          ))}
        </ul>

        {r.oneOffs.length > 0 ? (
          <div className="flex flex-col gap-xs rounded-lg border border-dashed border-border p-md">
            <span className="text-xs font-bold uppercase tracking-wide text-text-muted">{t.reveal.oneOffsTitle}</span>
            {r.oneOffs.map((o, i) => (
              <span key={i} className="flex justify-between gap-md text-sm">
                <span className="truncate">{o.label}</span>
                <span className="tabular-nums text-text-muted">{formatMoney(o.amount)}</span>
              </span>
            ))}
          </div>
        ) : null}
        {r.categorizedBy ? <p className="text-xs text-text-muted">{t.reveal.categorizedBy[r.categorizedBy]}</p> : null}
      </section>

      <section className="flex flex-col gap-lg lg:sticky lg:top-xl lg:self-start">
        {questions.length > 0 ? (
          <div className="flex flex-col gap-md">
            <div>
              <h2 className="text-2xl">{t.review.questionsTitle}</h2>
              <p className="text-sm text-text-muted">{t.review.questionsLead}</p>
            </div>
            <ul className="flex flex-col gap-sm">
              {questions.slice(0, 3).map((q) => (
                <Question key={q.id} q={q} onAnswerCategory={onAnswerCategory} onAnswerNone={onAnswerNone} onSkip={onSkip} />
              ))}
            </ul>
          </div>
        ) : null}
        <div className="flex flex-col gap-sm rounded-xl bg-ink p-xl text-on-primary">
          <Button size="lg" fullWidth onClick={onFinish} data-testid="start-finish" className="shadow-[0_10px_30px_rgb(255_91_46/0.4)]">
            {t.review.cta}<ArrowIcon />
          </Button>
          <p className="text-xs text-on-primary/60">{t.review.estimatesNote}</p>
          <button type="button" onClick={onRestart} className="w-fit text-sm font-semibold text-on-primary/70 hover:text-on-primary">
            {t.review.again}
          </button>
        </div>
      </section>
    </div>
  );
}
