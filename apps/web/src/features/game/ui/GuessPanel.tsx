import { useId } from 'react';
import { game as t } from '@/copy';
import { Button, Field, NumberInput, Slider, cx, formatMoney } from '@/ui-kit';
import type { Money, SliderVM, VMError } from '../model/types';
import { errorText } from './errorText';

export type GuessPanelProps = {
  guess: SliderVM;
  onGuessChange: (value: Money) => void;
  onLockIn: () => void;
  /** The guess is being sent. */
  submitting: boolean;
  error: VMError | null;
  /** Streamer mode: guess and hidden answer as white tiles on the orange page, black lock-in button. */
  large?: boolean;
};

/** The guess: the amount shown huge, log-scale slider, a number box for exact typing, and the lock-in button. */
export function GuessPanel({ guess, onGuessChange, onLockIn, submitting, error, large = false }: GuessPanelProps) {
  const headingId = useId();
  const money = (v: number) => formatMoney(v);
  const shown = money(guess.value);

  const controls = (
    <div className="flex flex-col gap-md">
      <Slider
        label={t.guess.slider}
        value={guess.value}
        min={guess.min}
        max={guess.max}
        step={guess.step}
        scale="log"
        formatValue={money}
        hint={t.guess.hint}
        disabled={submitting}
        onValueChange={onGuessChange}
      />
      <Field label={t.guess.input} className="sm:max-w-[calc(var(--spacing-3xl)*5)]">
        <NumberInput
          value={guess.value}
          min={guess.min}
          max={guess.max}
          maxFractionDigits={0}
          prefix="$"
          suffix={t.guess.inputSuffix}
          disabled={submitting}
          onValueChange={(v) => {
            if (v !== null) onGuessChange(v);
          }}
        />
      </Field>
    </div>
  );

  return (
    <section aria-labelledby={headingId} className="flex min-w-0 flex-col gap-lg">
      <h2 id={headingId} className={cx('font-semibold', large ? 'text-2xl' : 'text-lg')}>
        {t.guess.heading}
      </h2>

      {large ? (
        <>
          {/* The guess and the still-hidden answer, as two slightly tilted white tiles. */}
          <div aria-hidden="true" className="grid grid-cols-1 gap-lg sm:grid-cols-2">
            <div className="flex flex-col gap-xs rounded-xl bg-surface p-xl text-text shadow-lg sm:-rotate-1">
              <span className="text-sm text-text-muted">{t.streamer.guessLabel}</span>
              <span className="font-display text-4xl font-extrabold leading-tight tabular-nums">{shown}</span>
            </div>
            <div className="flex flex-col gap-xs rounded-xl bg-surface p-xl text-text shadow-lg sm:rotate-1">
              <span className="text-sm text-text-muted">{t.streamer.realCost}</span>
              <span className="font-display text-4xl font-extrabold leading-tight text-border">{t.streamer.hiddenCost}</span>
            </div>
          </div>
          <p className="sr-only">{t.streamer.hiddenCostLabel}</p>
          <div className="rounded-xl bg-surface p-xl text-text shadow-md">{controls}</div>
        </>
      ) : (
        <>
          {/* Same value as the slider's output; shown huge, hidden from screen readers to avoid repeating it. */}
          <p aria-hidden="true" className="flex flex-wrap items-end gap-x-md">
            <span className="font-display text-display font-extrabold leading-display text-primary tabular-nums lg:text-[length:calc(var(--text-display)*1.8)]">
              {shown}
            </span>
            <span className="pb-sm text-xl text-text-muted">{t.guess.perMonth}</span>
          </p>
          {controls}
        </>
      )}

      {error && (
        <p role="alert" className={cx('text-sm font-medium', large ? 'rounded-md bg-surface px-md py-sm text-negative' : 'text-negative')}>
          {error.kind === 'alreadyGuessed' ? t.errors.alreadyGuessed : `${t.errors.guess} ${errorText(error)}`}
        </p>
      )}
      <Button
        variant={large ? 'dark' : 'primary'}
        size="lg"
        fullWidth
        onClick={onLockIn}
        disabled={submitting}
        className={cx(large && 'text-2xl')}
      >
        {submitting ? t.guess.locking : error ? t.errors.guessRetry : t.guess.lockIn(shown)}
      </Button>
    </section>
  );
}
