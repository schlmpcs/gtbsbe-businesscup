'use client';

import { loan as t } from '@/copy';
import { Choice } from '@/ui-kit';
import type { PayoffChoice, PayoffPlannerVM } from '../model/types';

const OPTIONS: { value: PayoffChoice; label: string }[] = [
  { value: 'avalanche', label: t.planner.method.names.avalanche },
  { value: 'snowball', label: t.planner.method.names.snowball },
];

/** Avalanche or snowball, with one plain line on what the picked one optimizes. */
export function MethodToggle({ method, setMethod }: Pick<PayoffPlannerVM, 'method' | 'setMethod'>) {
  return (
    <Choice
      legend={t.planner.method.legend}
      name="payoff-method"
      value={method}
      options={OPTIONS}
      onChange={setMethod}
      hint={t.planner.method.describes[method]}
    />
  );
}
