import { game as t } from '@/copy';
import { Button, Card, Field, NumberInput, Slider, cx, formatMoney } from '@/ui-kit';
import type { Money, SliderVM, VMError } from '../model/types';
import { errorText } from './errorText';

export type GuessPanelProps = {
  guess: SliderVM;
  onGuessChange: (value: Money) => void;
  onLockIn: () => void;
  /** The guess is being sent. */
  submitting: boolean;
  error: VMError | null;
  large?: boolean;
};

/** The guess: log-scale slider, a number box for exact typing, and the lock-in button. */
export function GuessPanel({ guess, onGuessChange, onLockIn, submitting, error, large = false }: GuessPanelProps) {
  const money = (v: number) => formatMoney(v);
  return (
    <Card title={t.guess.heading} className={cx(large && 'text-lg')}>
      <div className="flex flex-col gap-lg">
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
        <Field label={t.guess.input}>
          <NumberInput
            value={guess.value}
            min={guess.min}
            max={guess.max}
            maxFractionDigits={0}
            prefix="$"
            suffix={t.guess.inputSuffix}
            disabled={submitting}
            // Select the number once the box has swapped in its plain text, so typing replaces the guess.
            onFocus={(e) => {
              const box = e.currentTarget;
              requestAnimationFrame(() => {
                if (document.activeElement === box) box.select();
              });
            }}
            onValueChange={(v) => {
              if (v !== null) onGuessChange(v);
            }}
          />
        </Field>
        {error && (
          <p role="alert" className="text-sm font-medium text-negative">
            {error.kind === 'alreadyGuessed' ? t.errors.alreadyGuessed : `${t.errors.guess} ${errorText(error)}`}
          </p>
        )}
        <Button size="lg" fullWidth onClick={onLockIn} disabled={submitting} className={cx(large && 'text-2xl')}>
          {submitting ? t.guess.locking : error ? t.errors.guessRetry : t.guess.lockIn(money(guess.value))}
        </Button>
      </div>
    </Card>
  );
}
