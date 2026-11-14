'use client';

import { loan as t } from '@/copy';
import { Button, cx, Field, formatMoney, useFieldControl } from '@/ui-kit';
import type { PayoffPlannerVM } from '../model/types';
import { dateText } from './PayoffCompare';

/** A month box: a native month picker where there is one, plain "2030-12" text where there is not. */
function MonthInput({ value, min, max, onChange }: { value: string; min?: string; max?: string; onChange: (value: string) => void }) {
  const field = useFieldControl();
  return (
    <input
      {...field}
      type="month"
      value={value}
      min={min}
      max={max}
      placeholder="YYYY-MM"
      onChange={(e) => onChange(e.target.value)}
      className={cx(
        'rounded-md border bg-bg px-md py-md text-base tabular-nums',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        field['aria-invalid'] ? 'border-negative' : 'border-border',
      )}
    />
  );
}

function fieldError(target: PayoffPlannerVM['target']): string | undefined {
  switch (target.status) {
    case 'invalid':
      return t.planner.target.invalid;
    case 'past':
      return t.planner.target.past;
    case 'tooFar':
      return t.planner.target.tooFar(target.years);
    default:
      return undefined;
  }
}

function resultText(target: PayoffPlannerVM['target'], extraNow: number): string | null {
  switch (target.status) {
    case 'needs':
      return t.planner.target.needs(dateText(target.date), formatMoney(target.extraNeeded));
    case 'onTrack':
      return target.extraNeeded === 0
        ? t.planner.target.onTrackMinimums(dateText(target.date))
        : t.planner.target.onTrack(dateText(target.date), formatMoney(extraNow));
    case 'unreachable':
      return t.planner.target.unreachable(dateText(target.date));
    case 'error':
      return t.planner.target.error;
    default:
      return null;
  }
}

/** "Debt-free by [month]": the extra payment per month the engine finds for the picked method. */
export function TargetDate({ vm }: { vm: PayoffPlannerVM }) {
  const text = resultText(vm.target, vm.extra.value);
  return (
    <div className="flex flex-col gap-md">
      <h3 className="text-lg font-bold">{t.planner.target.title}</h3>
      <div className="flex flex-wrap items-end gap-md">
        <Field label={t.planner.target.label} hint={t.planner.target.hint} error={fieldError(vm.target)}>
          <MonthInput value={vm.targetDate ?? ''} min={vm.targetBounds?.min} max={vm.targetBounds?.max} onChange={vm.setTargetDate} />
        </Field>
        {vm.targetDate !== null && (
          <Button variant="ghost" size="sm" onClick={() => vm.setTargetDate(null)}>
            {t.planner.target.clear}
          </Button>
        )}
      </div>
      <p data-testid="payoff-target-result" aria-live="polite" className="text-lg font-semibold">
        {text}
      </p>
    </div>
  );
}
