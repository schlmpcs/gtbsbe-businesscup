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
  /** Id of the test card note (TestCardNote), which describes the button when checkout is on. */
  testCardId: string;
};

/** The black test-checkout button on the orange band, and why it may be off. */
export function CheckoutBlock({ available, busy, disabled, error, onCheckout, testCardId }: Props) {
  const noteId = useId();
  return (
    <div className="flex w-full flex-col items-center gap-md">
      <Button
        variant="dark"
        size="lg"
        fullWidth
        disabled={!available || disabled}
        aria-busy={busy || undefined}
        aria-describedby={available ? testCardId : noteId}
        onClick={onCheckout}
      >
        {busy ? copy.checkout.busy : copy.checkout.button}
      </Button>
      {!available && (
        <p id={noteId} className="text-sm">
          {copy.checkout.unavailable}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm font-semibold text-negative">
          {errorText(error)}
        </p>
      )}
    </div>
  );
}

/** The Stripe test card to use on the next page (shown only when test checkout is on). */
export function TestCardNote({ id }: { id: string }) {
  return (
    <Card tone="muted" id={id} title={copy.checkout.testCardTitle} headingLevel={3}>
      <p className="font-mono text-lg tracking-wide">{copy.checkout.testCardNumber}</p>
      <p className="mt-xs text-sm">{copy.checkout.testCardDetails}</p>
      <p className="mt-xs text-xs text-text-muted">{copy.checkout.testCardNote}</p>
    </Card>
  );
}
