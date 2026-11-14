import { useId } from 'react';
import { pro as copy } from '@/copy';
import { Art, Button, cx, Sticker } from '@/ui-kit';
import type { CheckoutMode, PaywallError, PaywallVM } from '../model/types';
import { CheckoutBlock, TestCardNote } from './CheckoutBlock';
import { DemoCheckoutBlock } from './DemoCheckoutBlock';
import { errorText } from './errorText';
import { IncludesList } from './IncludesList';
import { PlanPicker } from './PlanPicker';
import { ProActive } from './ProActive';
import { PromoCodeForm } from './PromoCodeForm';

export type PaywallProps = PaywallVM;

/** The badge over the offer. Only a mode that is really on may be named; 'off' covers "not known yet" too. */
const BADGE: Record<CheckoutMode, string> = { stripe: copy.demoBadge.stripe, demo: copy.demoBadge.demo, off: copy.demoBadge.neutral };

const errorIn = (error: PaywallError | null, ...where: PaywallError['where'][]) => (error && where.includes(error.where) ? error : null);

/** Anchor of the promo form, for the "Have a promo code?" link in the fine print. */
const PROMO_ANCHOR = 'pro-promo-code';

/**
 * The route keeps a narrow column; on wide screens the paywall widens to two columns, centered on
 * the page (left offset + translate, so it never adds sideways scroll).
 */
const WIDE = 'lg:relative lg:left-1/2 lg:w-[min(calc(100vw-var(--spacing-3xl)*2),var(--container-6xl))] lg:-translate-x-1/2';

/**
 * S15 Pro paywall (demo, Figma Design v3 node 193:1653): the headline and the blueprint house on
 * the left; the plans, what Pro includes today, the checkout (Stripe's test checkout, or the
 * simulated one when the server has no Stripe key) and the fine print on the right; then the
 * judges' promo code.
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
    <div className={cx('mt-xl grid grid-cols-1 items-start gap-2xl lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]', WIDE)}>
      <div className="flex flex-col gap-lg">
        <h1 className="font-display text-display font-extrabold leading-display lg:text-[length:calc(var(--text-display)*1.4)]">
          {copy.headline}
        </h1>
        <p className="max-w-prose text-lg text-text-muted">{copy.lead}</p>
        <Art name="house-blueprint" className="mx-auto w-1/2 max-w-(--container-md) sm:w-3/4 lg:w-full" />
      </div>

      <div className="flex flex-col gap-xl">
        <Sticker tone="ink" tilt={-2}>
          {BADGE[vm.checkoutMode]}
        </Sticker>

        {/* One polite live region for every status change on the screen (loading, Stripe return, errors). */}
        <div role="status" aria-live="polite" className="flex flex-col items-start gap-sm">
          {message && <p className="text-lg font-semibold">{message}</p>}
          {pageError && <p className="font-semibold text-negative">{errorText(pageError)}</p>}
          {pageError && vm.retry && (
            <Button variant="secondary" size="sm" onClick={vm.retry}>
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
            <div className="flex flex-wrap items-center justify-between gap-x-lg gap-y-xs text-xs text-text-muted">
              <span>{copy.plans.priceNote}</span>
              {vm.promoEnabled && (
                <a href={`#${PROMO_ANCHOR}`} className="font-semibold text-primary underline-offset-2 hover:underline">
                  {copy.finePrint.promoLink}
                </a>
              )}
            </div>
            {stripe && <TestCardNote id={testCardId} />}
            {vm.promoEnabled && (
              <PromoCodeForm
                id={PROMO_ANCHOR}
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

        {/* The "not financial advice" disclaimer is in the app footer on every page. */}
      </div>
    </div>
  );
}
