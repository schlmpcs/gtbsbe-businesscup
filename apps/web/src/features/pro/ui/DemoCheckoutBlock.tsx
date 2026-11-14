import { useId } from 'react';
import { pro as copy } from '@/copy';
import { Button, Card, Money } from '@/ui-kit';
import type { PaywallError, PaywallPlanVM } from '../model/types';
import { errorText } from './errorText';

type Props = {
  /** The selected plan: the order shows it and the button pays for it. */
  plan: PaywallPlanVM;
  busy: boolean;
  disabled: boolean;
  error: PaywallError | null;
  onPay: () => void;
};

/**
 * The simulated checkout: the order, a read-only demo card and a Pay (demo) button. There is no
 * card field on purpose: nothing is typed, sent or charged, and a form that looks real would
 * invite real card numbers into a demo.
 */
export function DemoCheckoutBlock({ plan, busy, disabled, error, onPay }: Props) {
  const noteId = useId();
  const price = <Money value={plan.amount} cents />;
  return (
    // Not `max-w-md`: in this theme a bare size name reads the spacing token (--spacing-md, 12px),
    // which squeezed the whole card into a sliver. The container size is spelled out.
    <Card title={copy.demoCheckout.title} headingLevel={3} className="w-full max-w-(--container-md) text-left text-ink">
      <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-lg gap-y-sm text-sm">
        <dt className="text-ink/60">{copy.demoCheckout.orderLabel}</dt>
        <dd className="flex flex-wrap items-baseline justify-between gap-x-md">
          <span className="font-semibold">{copy.demoCheckout.orderItem(copy.plans.names[plan.id])}</span>
          <span>
            {price} {copy.plans.per[plan.interval]}
          </span>
        </dd>
        <dt className="text-ink/60">{copy.demoCheckout.payWithLabel}</dt>
        <dd className="font-mono">{copy.demoCheckout.card}</dd>
      </dl>
      {/* This card is white inside the orange band, whose ON_ARENA rule turns every `.text-text-muted`
          and `.text-negative` below it white. So the note and the error use colours that rule does not
          match: ink at 60% (like the labels above) and the negative token itself. */}
      <p id={noteId} className="mt-md text-xs text-ink/60">
        {copy.demoCheckout.note}
      </p>
      <Button
        variant="dark"
        size="lg"
        fullWidth
        className="mt-lg"
        disabled={disabled}
        aria-busy={busy || undefined}
        aria-describedby={noteId}
        onClick={onPay}
      >
        {busy ? (
          copy.demoCheckout.busy
        ) : (
          <>
            {copy.demoCheckout.pay} {price} {copy.demoCheckout.demoTag}
          </>
        )}
      </Button>
      {error && (
        <p role="alert" className="mt-md text-sm font-semibold text-(--color-negative)">
          {errorText(error)}
        </p>
      )}
    </Card>
  );
}
