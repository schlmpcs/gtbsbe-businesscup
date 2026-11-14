import { pro as copy } from '@/copy';
import { cx, EstimateTag, Money } from '@/ui-kit';
import type { PaywallPlanVM, ProPlan } from '../model/types';

type Props = {
  plans: PaywallPlanVM[];
  onSelect: (plan: ProPlan) => void;
  disabled: boolean;
};

/** The two plans as a native radio group, so arrow keys and screen readers work as usual. */
export function PlanPicker({ plans, onSelect, disabled }: Props) {
  return (
    <fieldset disabled={disabled} className="flex flex-col gap-sm">
      <legend className="mb-sm flex flex-wrap items-center gap-sm text-sm font-medium">
        {copy.plans.legend}
        {plans.some((p) => p.isEstimate) && <EstimateTag />}
      </legend>
      {plans.map((plan) => (
        <label
          key={plan.id}
          className={cx(
            'flex cursor-pointer items-center gap-md rounded-md border p-md',
            plan.selected ? 'border-primary bg-surface' : 'border-border bg-bg',
          )}
        >
          <input
            type="radio"
            name="pro-plan"
            value={plan.id}
            checked={plan.selected}
            onChange={() => onSelect(plan.id)}
            className="size-4 accent-primary"
          />
          <span className="flex flex-1 flex-wrap items-baseline justify-between gap-sm">
            <span className="flex items-center gap-sm font-semibold">
              {copy.plans.names[plan.id]}
              {plan.id === 'yearly' && (
                <span className="rounded-full bg-primary px-sm text-xs font-medium text-on-primary">{copy.plans.yearlyBadge}</span>
              )}
            </span>
            <span>
              <Money value={plan.amount} cents className="text-lg font-semibold" />{' '}
              <span className="text-sm text-text-muted">{copy.plans.per[plan.interval]}</span>
            </span>
          </span>
        </label>
      ))}
      <p className="text-xs text-text-muted">{copy.plans.priceNote}</p>
    </fieldset>
  );
}
