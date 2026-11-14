'use client';

// The six steps as a row of buttons. The current one is marked; one that cannot be reached yet is disabled.
import { subscriptions as t } from '@/copy';
import { cx } from '@/ui-kit';
import type { StepVM, SubscriptionsStep } from '../model/types';

export type StepNavProps = { steps: StepVM[]; current: SubscriptionsStep; onGo: (step: SubscriptionsStep) => void };

export function StepNav({ steps, current, onGo }: StepNavProps) {
  return (
    <nav aria-label={t.stepper.label}>
      <ol className="flex flex-wrap gap-sm">
        {steps.map((step, index) => (
          <li key={step.id}>
            <button
              type="button"
              disabled={!step.available}
              aria-current={step.id === current ? 'step' : undefined}
              onClick={() => onGo(step.id)}
              className={cx(
                'min-h-11 rounded-full border-2 px-lg py-xs text-sm font-medium leading-normal transition-colors',
                'disabled:cursor-not-allowed disabled:opacity-50',
                step.id === current ? 'border-ink bg-ink text-on-primary' : 'border-border bg-surface hover:border-text',
              )}
            >
              <span className="mr-xs tabular-nums opacity-70">{index + 1}</span>
              {t.stepper.steps[step.id]}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
