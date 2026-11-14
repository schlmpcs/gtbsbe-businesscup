import { useId } from 'react';
import { common, pro as copy } from '@/copy';
import { Button, cx, Sticker } from '@/ui-kit';
import type { PaywallError, PaywallVM } from '../model/types';
import { FULL_BLEED_PRIMARY, ON_ARENA } from './arena';
import { CheckoutBlock, TestCardNote } from './CheckoutBlock';
import { DemoCheckoutBlock } from './DemoCheckoutBlock';
import { errorText } from './errorText';
import { IncludesList } from './IncludesList';
import { PlanPicker } from './PlanPicker';
import { ProActive } from './ProActive';
import { PromoCodeForm } from './PromoCodeForm';

export type PaywallProps = PaywallVM;

const errorIn = (error: PaywallError | null, ...where: PaywallError['where'][]) => (error && where.includes(error.where) ? error : null);

/**
 * S15 Pro paywall (demo): an orange band with the plans and a checkout (Stripe's test checkout, or
 * the simulated one when the server has no Stripe key), then the judges' promo code.
 */
export function Paywall(vm: PaywallProps) {
  const testCardId = useId();
  const locked = vm.busy !== null || vm.coolingDown;
  const stripe = vm.checkoutMode === 'stripe';
  const selectedPlan = vm.plans.find((p) => p.selected) ?? vm.plans[0]!;
  const pageError = errorIn(vm.error, 'status', 'confirm');
  const message =
    vm.view === 'confirming' ? copy.confirming : vm.cancelled ? copy.cancelled : vm.view === 'loading' ? copy.loading : null;
  const offer = vm.view === 'offer';

  return (
    <div className="mt-lg flex flex-col gap-xl">
      <div className={cx(FULL_BLEED_PRIMARY, ON_ARENA, 'flex flex-col items-center gap-xl py-2xl text-center sm:py-3xl')}>
        <Sticker tone="ink" tilt={-2}>
          {vm.checkoutMode === 'demo' ? copy.demoBadge.demo : copy.demoBadge.stripe}
        </Sticker>

        {offer && (
          <h2 className="font-display text-display leading-display font-extrabold sm:text-7xl sm:leading-display">{copy.headline}</h2>
        )}

        {/* One polite live region for every status change on the screen (loading, Stripe return, errors). */}
        <div role="status" aria-live="polite" className="flex flex-col items-center gap-sm">
          {message && <p className="text-lg font-semibold">{message}</p>}
          {pageError && <p className="font-semibold text-negative">{errorText(pageError)}</p>}
          {pageError && vm.retry && (
            <Button variant="dark" size="sm" onClick={vm.retry}>
              {copy.retry}
            </Button>
          )}
        </div>

        {vm.pro && (vm.view === 'success' || vm.view === 'pro') && (
          <ProActive pro={vm.pro} justUnlocked={vm.view === 'success'} continueHref={vm.continueHref} />
        )}

        {offer && (
          <>
            <PlanPicker plans={vm.plans} onSelect={vm.selectPlan} disabled={locked} />
            <IncludesList />
            {vm.checkoutMode === 'demo' ? (
              <DemoCheckoutBlock
                plan={selectedPlan}
                busy={vm.busy === 'demoCheckout'}
                disabled={locked}
                error={errorIn(vm.error, 'checkout')}
                onPay={vm.payDemo}
              />
            ) : (
              <CheckoutBlock
                available={stripe}
                busy={vm.busy === 'checkout'}
                disabled={locked}
                error={errorIn(vm.error, 'checkout')}
                onCheckout={vm.startCheckout}
                testCardId={testCardId}
              />
            )}
            <p className="text-xs">{common.disclaimer}</p>
          </>
        )}
      </div>

      {offer && (stripe || vm.promoEnabled) && (
        <div className="grid items-start gap-lg sm:grid-cols-2">
          {stripe && <TestCardNote id={testCardId} />}
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
        </div>
      )}

      {!offer && <p className="text-xs text-text-muted">{common.disclaimer}</p>}
    </div>
  );
}
