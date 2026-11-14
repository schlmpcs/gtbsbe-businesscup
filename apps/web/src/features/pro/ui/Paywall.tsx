import { common, pro as copy } from '@/copy';
import { Button, Card, Stack } from '@/ui-kit';
import type { PaywallError, PaywallVM } from '../model/types';
import { CheckoutBlock } from './CheckoutBlock';
import { errorText } from './errorText';
import { IncludesList } from './IncludesList';
import { PlanPicker } from './PlanPicker';
import { ProActive } from './ProActive';
import { PromoCodeForm } from './PromoCodeForm';

export type PaywallProps = PaywallVM;

const errorIn = (error: PaywallError | null, ...where: PaywallError['where'][]) => (error && where.includes(error.where) ? error : null);

/** S15 Pro paywall (demo). Placeholder styling until the Figma frame lands. */
export function Paywall(vm: PaywallProps) {
  const locked = vm.busy !== null || vm.coolingDown;
  const pageError = errorIn(vm.error, 'status', 'confirm');
  const message =
    vm.view === 'confirming' ? copy.confirming : vm.cancelled ? copy.cancelled : vm.view === 'loading' ? copy.loading : null;

  return (
    <Stack gap="lg" className="mt-lg">
      <p className="self-start rounded-full border border-warning px-md py-xs text-xs font-semibold">{copy.demoBadge}</p>

      {/* One polite live region for every status change on the screen (loading, Stripe return, errors). */}
      <div role="status" aria-live="polite" className="flex flex-col items-start gap-sm">
        {message && <p>{message}</p>}
        {pageError && <p className="font-medium text-negative">{errorText(pageError)}</p>}
        {pageError && vm.retry && (
          <Button variant="secondary" size="sm" onClick={vm.retry}>
            {copy.retry}
          </Button>
        )}
      </div>

      {vm.pro && (vm.view === 'success' || vm.view === 'pro') && (
        <ProActive pro={vm.pro} justUnlocked={vm.view === 'success'} continueHref={vm.continueHref} />
      )}

      {vm.view === 'offer' && (
        <>
          <p>{copy.intro}</p>
          <IncludesList />
          <Card>
            <Stack gap="lg">
              <PlanPicker plans={vm.plans} onSelect={vm.selectPlan} disabled={locked} />
              <CheckoutBlock
                available={vm.checkoutAvailable}
                busy={vm.busy === 'checkout'}
                disabled={locked}
                error={errorIn(vm.error, 'checkout')}
                onCheckout={vm.startCheckout}
              />
            </Stack>
          </Card>
          {vm.promoEnabled && (
            <PromoCodeForm
              code={vm.promoCode}
              onCodeChange={vm.setPromoCode}
              onRedeem={vm.redeem}
              busy={vm.busy === 'promo'}
              disabled={locked}
              error={errorIn(vm.error, 'promo')}
            />
          )}
        </>
      )}

      <p className="text-xs text-text-muted">{common.disclaimer}</p>
    </Stack>
  );
}
