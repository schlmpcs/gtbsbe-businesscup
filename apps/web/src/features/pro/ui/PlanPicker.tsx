import { pro as copy } from '@/copy';
import { cx, EstimateTag, Money, Sticker } from '@/ui-kit';
import type { PaywallPlanVM, ProPlan } from '../model/types';
import { tilt } from './arena';

type Props = {
  plans: PaywallPlanVM[];
  onSelect: (plan: ProPlan) => void;
  disabled: boolean;
};

const PLAN_TILT: Record<ProPlan, number> = { yearly: -2, monthly: 2 };

/** The two plans as white tiles over a native radio group, so arrow keys and screen readers work as usual. */
export function PlanPicker({ plans, onSelect, disabled }: Props) {
  return (
    <fieldset disabled={disabled} className="flex w-full flex-col items-center gap-lg">
      <legend className="mb-lg flex flex-wrap items-center justify-center gap-sm text-sm font-semibold">
        {copy.plans.legend}
        {plans.some((p) => p.isEstimate) && <EstimateTag />}
      </legend>
      <div className="grid w-full gap-xl sm:grid-cols-2">
        {plans.map((plan) => (
          <label
            key={plan.id}
            style={tilt(PLAN_TILT[plan.id])}
            className={cx(
              'relative flex cursor-pointer flex-col items-start gap-xs rounded-xl border-4 bg-surface p-xl text-left text-ink shadow-lg',
              'has-focus-visible:outline-4 has-focus-visible:outline-offset-4 has-focus-visible:outline-ink has-disabled:cursor-not-allowed has-disabled:opacity-70',
              plan.selected ? 'border-ink' : 'border-transparent',
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
              <Sticker tone="ink" tilt={-4} className="absolute -top-md right-xl shadow-md">
                {copy.plans.yearlyBadge}
              </Sticker>
            )}
            <span className="text-lg font-bold">{copy.plans.names[plan.id]}</span>
            <span className="flex flex-wrap items-baseline gap-sm">
              <Money value={plan.amount} cents className="font-display text-5xl font-extrabold leading-tight" />
              <span className="text-sm text-ink/60">{copy.plans.per[plan.interval]}</span>
            </span>
          </label>
        ))}
      </div>
      <p className="text-xs">{copy.plans.priceNote}</p>
    </fieldset>
  );
}
