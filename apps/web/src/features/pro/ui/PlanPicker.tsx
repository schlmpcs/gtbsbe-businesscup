import { pro as copy } from '@/copy';
import { cx, Money, Sticker } from '@/ui-kit';
import type { PaywallPlanVM, ProPlan } from '../model/types';

type Props = {
  plans: PaywallPlanVM[];
  onSelect: (plan: ProPlan) => void;
  disabled: boolean;
};

/**
 * The plans as white cards over a native radio group, so arrow keys and screen readers work as
 * usual. The model lists yearly first and preselects it; the selected card gets the orange ring.
 */
export function PlanPicker({ plans, onSelect, disabled }: Props) {
  return (
    <fieldset disabled={disabled} className="flex w-full flex-col gap-md">
      {/* Demo prices, said once in the fine print (priceNote); no "estimate" tag: a price is not an estimate. */}
      <legend className="mb-md text-sm font-semibold text-text-muted">{copy.plans.legend}</legend>
      <div className="grid w-full gap-lg sm:grid-cols-2">
        {plans.map((plan) => (
          <label
            key={plan.id}
            className={cx(
              'relative flex cursor-pointer flex-col items-start gap-sm rounded-xl bg-surface p-xl text-left shadow-md transition-shadow',
              'has-focus-visible:outline-4 has-focus-visible:outline-offset-4 has-focus-visible:outline-primary has-disabled:cursor-not-allowed has-disabled:opacity-70',
              plan.selected && 'inset-ring-3 inset-ring-primary',
            )}
          >
            <input
              type="radio"
              name="pro-plan"
              value={plan.id}
              checked={plan.selected}
              onChange={() => onSelect(plan.id)}
              className="sr-only"
            />
            {plan.id === 'yearly' && (
              <Sticker tone="primary" tilt={-4} className="absolute -top-sm right-lg">
                {copy.plans.yearlyBadge}
              </Sticker>
            )}
            <span className="text-lg font-bold">{copy.plans.names[plan.id]}</span>
            <span className="flex flex-wrap items-baseline gap-sm">
              <Money value={plan.amount} cents className="font-display text-5xl font-extrabold leading-tight" />
              <span className="text-sm text-text-muted">{copy.plans.per[plan.interval]}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
