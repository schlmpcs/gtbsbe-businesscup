'use client';
import { start as t } from '@/copy';
import { TextShimmer } from '@/ui-kit/arc';
import { Button, cx, formatMoney, Slider } from '@/ui-kit';
import type { GuessVM, ReadingVM, StartError } from '../model/types';
import { CheckIcon, LockIcon } from './icons';

export type ReadingViewProps = {
  reading: ReadingVM;
  guess: GuessVM;
  error: StartError | null;
  onSkipGuess: () => void;
  onRetry: () => void;
  onBack: () => void;
};

function stepLabels(reading: ReadingVM): string[] {
  return [
    reading.source === 'bank' ? t.reading.steps.fetchBank : t.reading.steps.fetch,
    t.reading.steps.parse(reading.lineCount ?? 0),
    t.reading.steps.mask,
    t.reading.steps.sort,
    t.reading.steps.find,
  ];
}

/** Step 3: the statement is read through the real pipeline; meanwhile the user guesses the month. */
export function ReadingView({ reading, guess, error, onSkipGuess, onRetry, onBack }: ReadingViewProps) {
  const labels = stepLabels(reading);
  // An upload has no "building" step.
  const shown = reading.source === 'upload' ? labels.slice(1).map((l, i) => ({ l, i: i + 1 })) : labels.map((l, i) => ({ l, i }));
  const title = reading.source === 'generated'
    ? t.reading.title.generated
    : reading.source === 'bank'
      ? t.reading.title.bank(reading.bankName ?? '')
      : t.reading.title.upload;

  return (
    <div className="grid grid-cols-1 gap-xl [&>*]:min-w-0 lg:grid-cols-[1fr_1fr] lg:gap-3xl">
      <section className="flex flex-col gap-lg" aria-live="polite">
        <h1 className="text-3xl leading-tight">{title}</h1>

        {error ? (
          <div className="flex flex-col gap-md rounded-xl border border-negative/30 bg-surface p-lg">
            <p className="font-semibold text-negative">{t.errors[error.kind]}</p>
            <div className="flex gap-sm">
              <Button onClick={onRetry}>{t.errors.retry}</Button>
              <Button variant="ghost" onClick={onBack}>{t.review.again}</Button>
            </div>
          </div>
        ) : (
          <ol className="flex flex-col gap-sm">
            {shown.map(({ l, i }) => {
              const state = reading.done || i < reading.phase ? 'done' : i === reading.phase ? 'active' : 'todo';
              return (
                <li key={i} className={cx('flex items-center gap-md rounded-lg border px-md py-sm transition-all duration-300',
                  state === 'done' && 'border-border bg-surface',
                  state === 'active' && 'border-ink bg-surface shadow-[0_6px_18px_rgb(29_27_24/0.08)]',
                  state === 'todo' && 'border-transparent opacity-45')}>
                  <span className={cx('grid size-6 shrink-0 place-items-center rounded-full transition-colors',
                    state === 'done' ? 'bg-positive text-on-primary' : state === 'active' ? 'bg-ink text-on-primary' : 'bg-surface-strong text-text-muted')}>
                    {state === 'done' ? <CheckIcon /> : <span className="text-xs font-bold">{i + (reading.source === 'upload' ? 0 : 1)}</span>}
                  </span>
                  {state === 'active'
                    ? <TextShimmer className="text-sm font-semibold">{l}</TextShimmer>
                    : <span className="text-sm font-semibold">{l}</span>}
                </li>
              );
            })}
          </ol>
        )}

        <div className="flex flex-col gap-sm rounded-xl bg-ink p-lg text-on-primary">
          <div className="flex items-center gap-sm">
            <LockIcon />
            <span className="text-sm font-bold">{t.reading.leavesTitle}</span>
          </div>
          <ul className="flex flex-col gap-[6px] font-mono text-xs">
            {reading.masked.map((line, i) => (
              <li key={i} className="flex items-baseline justify-between gap-md opacity-0 [animation:fadeUp_.4s_ease_forwards]" style={{ animationDelay: `${i * 70}ms` }}>
                <span className="truncate text-on-primary/85">{line.label}</span>
                <span className="shrink-0 tabular-nums text-on-primary/60">{line.month}-{String(line.day).padStart(2, '0')}</span>
                <span className={cx('w-20 shrink-0 text-right tabular-nums', line.amount < 0 ? 'text-[#7ee2a8]' : 'text-on-primary')}>
                  {line.amount < 0 ? '+' : '−'}{formatMoney(Math.abs(line.amount), { cents: true })}
                </span>
              </li>
            ))}
            {reading.masked.length === 0 && !error ? <li className="text-on-primary/50"><TextShimmer>…</TextShimmer></li> : null}
          </ul>
          {reading.lineCount != null && reading.lineCount > reading.masked.length ? (
            <span className="text-xs text-on-primary/50">{t.reading.more(reading.lineCount - reading.masked.length)}</span>
          ) : null}
          <p className="text-xs text-on-primary/60">{t.reading.leavesNote}</p>
        </div>
      </section>

      <section className="flex flex-col gap-lg lg:sticky lg:top-xl lg:self-start">
        <div className="flex flex-col gap-lg rounded-xl border-2 border-primary bg-surface p-xl shadow-[0_20px_50px_rgb(255_91_46/0.15)]">
          <h2 className="text-2xl leading-tight">{guess.own ? t.reading.guessTitle.own : t.reading.guessTitle.other}</h2>
          <p className="font-display text-5xl font-extrabold tabular-nums text-primary">{formatMoney(guess.value)}</p>
          <Slider
            label={t.reading.guessLabel}
            value={guess.value}
            onValueChange={guess.set}
            min={guess.min}
            max={guess.max}
            step={50}
            scale="log"
            formatValue={(v) => formatMoney(v)}
            hint={t.reading.guessHint}
            disabled={guess.locked}
          />
          <Button
            size="lg"
            fullWidth
            variant={reading.done ? 'primary' : 'dark'}
            onClick={guess.lock}
            disabled={guess.locked}
            data-testid="lock-guess"
          >
            {guess.locked ? (reading.done ? t.reading.locked : t.reading.waiting) : t.reading.lock}
          </Button>
          {reading.done && !guess.locked ? (
            <button type="button" onClick={onSkipGuess} className="text-sm font-semibold text-text-muted underline-offset-2 hover:underline">
              {t.review.skip}
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
