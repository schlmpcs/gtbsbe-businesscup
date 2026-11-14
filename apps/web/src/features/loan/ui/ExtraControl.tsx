'use client';

import { loan as t } from '@/copy';
import { Field, formatMoney, NumberInput, Slider } from '@/ui-kit';
import type { PayoffPlannerVM } from '../model/types';

/** The planner's own extra payment, on all debts: a slider and a box. Not the selected offer's slider above. */
export function ExtraControl({ extra, extraLimit, setExtra }: Pick<PayoffPlannerVM, 'extra' | 'extraLimit' | 'setExtra'>) {
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
    </div>
  );
}
