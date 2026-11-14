'use client';

import { loan as t } from '@/copy';
import { Field, formatMoney, formatRate, NumberInput, Slider } from '@/ui-kit';
import type { PayoffPlannerVM, PayoffSuggestionVM } from '../model/types';

/** Where the starting amount came from, in the words of the copy; the amounts are the engine's. */
function suggestedText(s: PayoffSuggestionVM): string {
  if (s.extra > 0) return t.planner.extra.suggested.share(formatRate(s.share, 0), formatMoney(s.surplus));
  return s.surplus > 0 ? t.planner.extra.suggested.littleLeft(formatMoney(s.surplus)) : t.planner.extra.suggested.nothingLeft;
}

/** The planner's own extra payment, on all debts: a slider and a box. Not the selected offer's slider above. */
export function ExtraControl({
  extra,
  extraLimit,
  setExtra,
  suggestion,
  extraIsSuggested,
}: Pick<PayoffPlannerVM, 'extra' | 'extraLimit' | 'setExtra' | 'suggestion' | 'extraIsSuggested'>) {
  return (
    <div className="flex min-w-0 flex-col gap-md">
      <Slider
        label={t.planner.extra.label}
        value={extra.value}
        min={extra.min}
        max={extra.max}
        step={extra.step}
        onValueChange={setExtra}
        formatValue={(v) => `${formatMoney(v)}${t.planner.extra.perMonth}`}
        hint={t.planner.extra.hint}
      />
      <Field label={t.planner.extra.inputLabel}>
        <NumberInput
          value={extra.value}
          onValueChange={(v) => setExtra(v ?? 0)}
          min={0}
          max={extraLimit}
          prefix="$"
          suffix={t.planner.extra.perMonth}
        />
      </Field>
      {extraIsSuggested && suggestion && (
        <p data-testid="payoff-extra-suggested" className="text-sm text-text-muted">
          {suggestedText(suggestion)}
        </p>
      )}
    </div>
  );
}
