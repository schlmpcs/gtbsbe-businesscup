import { useId } from 'react';
import { pro as copy } from '@/copy';
import { Button, Card } from '@/ui-kit';
import type { PaywallError } from '../model/types';
import { errorText } from './errorText';

type Props = {
  available: boolean;
  busy: boolean;
  disabled: boolean;
  error: PaywallError | null;
  onCheckout: () => void;
};

/** The test-checkout button, why it may be off, and the Stripe test card to use on the next page. */
export function CheckoutBlock({ available, busy, disabled, error, onCheckout }: Props) {
  const noteId = useId();
  const cardId = useId();
  return (
    <div className="flex flex-col gap-md">
      <Button
        size="lg"
        fullWidth
        disabled={!available || disabled}
        aria-busy={busy || undefined}
        aria-describedby={available ? cardId : noteId}
        onClick={onCheckout}
      >
        {busy ? copy.checkout.busy : copy.checkout.button}
      </Button>
      {!available && (
        <p id={noteId} className="text-sm text-text-muted">
          {copy.checkout.unavailable}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm font-medium text-negative">
          {errorText(error)}
        </p>
      )}
      {available && (
        <Card tone="muted" id={cardId} title={copy.checkout.testCardTitle} headingLevel={3}>
          <p className="font-mono text-lg tracking-wide">{copy.checkout.testCardNumber}</p>
          <p className="mt-xs text-sm">{copy.checkout.testCardDetails}</p>
          <p className="mt-xs text-xs text-text-muted">{copy.checkout.testCardNote}</p>
        </Card>
      )}
    </div>
  );
}
