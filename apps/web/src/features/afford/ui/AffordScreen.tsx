'use client';

// S11 Can I Afford It?: inputs on the left (sticky on desktop), the answer on the right: the verdict card,
// what it does to the plan (with "Add to my plan"), then the details and the wishlist. All data and actions
// come from useAfford() and useAffordPlan(); nothing is computed here.
import { afford as t } from '@/copy';
import { cx } from '@/ui-kit';
import { MOTION } from '@/ui-kit/reports';
import { ToolPlanImpact, type ToolPlanImpactProps } from '@/ui-kit/ToolPlanImpact';
import { useId, useState } from 'react';
import type { AffordVM, Purchase, ToolPlanEventVM } from '../model/types';
import { AffordVerdictTile } from './AffordResultPanel';
import { Skeleton } from './controls';
import { PurchaseExamples, PurchaseForm } from './PurchaseForm';
import { PurchaseParse } from './PurchaseParse';
import { Wishlist, WishlistActions } from './Wishlist';

function Title() {
  return (
    <header className="flex flex-col gap-xs">
      <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">{t.screens.S11}</h1>
      <p className="text-base text-text-muted sm:text-lg">{t.intro}</p>
    </header>
  );
}

/** What "Add to my plan" will put on /plan, in words. */
function planWhat(p: Purchase): string {
  const w = t.result.planWhat;
  if (p.recurring !== false) return w[p.recurring](p.label);
  if (typeof p.payWith === 'object') return w.financed(p.label);
  return p.payWith === 'card' ? w.card(p.label) : w.once(p.label);
}

export type AffordScreenProps = {
  vm: AffordVM;
  /** The purchase on the plan (useAffordPlan); null hides the card (tests of the form alone). */
  plan?: ToolPlanEventVM | null;
  Link?: ToolPlanImpactProps['Link'];
};

const PlainLink: ToolPlanImpactProps['Link'] = ({ href, className, children }) => (
  <a href={href} className={className}>
    {children}
  </a>
);

export function AffordScreen({ vm, plan = null, Link = PlainLink }: AffordScreenProps) {
  const [justAdded, setJustAdded] = useState(false);
  const formTitleId = useId();
  const ready = vm.result?.status === 'ready' ? vm.result.data : null;
  const cheaperWay = ready && ready.cheapestWayFits && ready.cheapestWay !== vm.form.payWith ? ready.cheapestWay : null;
  const purchaseLabel = vm.purchase?.label ?? t.defaultPurchaseLabel;

  return (
    <main className="mx-auto w-full max-w-(--container-7xl) px-lg py-xl">
      <div className="flex flex-col gap-xl">
        <Title />
        {vm.status === 'loading' ? (
          <Skeleton label={t.loading} rows={4} />
        ) : (
          <>
            <div className="grid grid-cols-1 items-start gap-xl lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
              <section aria-labelledby={formTitleId} className={cx('card card-pad flex min-w-0 flex-col gap-lg lg:sticky lg:top-lg', MOTION.rise)}>
                <h2 id={formTitleId} className="text-lg font-bold leading-tight">
                  {t.form.title}
                </h2>
                <PurchaseExamples setLabel={vm.setLabel} setAmount={vm.setAmount} />
                <PurchaseForm
                  form={vm.form}
                  loanEstimate={vm.loanEstimate}
                  invalidFields={vm.invalidFields}
                  setLabel={vm.setLabel}
                  setAmount={vm.setAmount}
                  setRecurring={vm.setRecurring}
                  setPayWith={vm.setPayWith}
                  setLoan={vm.setLoan}
                />
                <PurchaseParse parse={vm.parse} />
              </section>
              <div className="flex min-w-0 flex-col gap-lg">
                <AffordVerdictTile
                  result={vm.result}
                  rules={vm.rules}
                  invalidFields={vm.invalidFields}
                  chosenWay={vm.form.payWith}
                  purchaseLabel={purchaseLabel}
                />
                {ready && plan && vm.purchase && (
                  <ToolPlanImpact
                    scenarioName={plan.scenarioName}
                    preview={plan.preview}
                    add={plan.add}
                    added={plan.added}
                    planHref={plan.planHref}
                    what={planWhat(vm.purchase)}
                    Link={Link}
                  />
                )}
                {/* Saving (and the Pro lock) only makes sense once there is a verdict to save. */}
                {ready && (
                  <WishlistActions
                    addToWishlist={vm.addToWishlist}
                    wishlistLocked={vm.wishlistLocked}
                    proHref={vm.proHref}
                    setPayWith={vm.setPayWith}
                    canAdd={vm.purchase !== null}
                    justAdded={justAdded}
                    onAdded={setJustAdded}
                    cheaperWay={cheaperWay}
                  />
                )}
              </div>
            </div>
            {vm.wishlist.length > 0 && (
              <Wishlist
                wishlist={vm.wishlist}
                removeFromWishlist={vm.removeFromWishlist}
                loadFromWishlist={vm.loadFromWishlist}
                onLoad={() => setJustAdded(false)}
              />
            )}
            <p className="text-xs text-text-muted">{t.footnote}</p>
          </>
        )}
      </div>
    </main>
  );
}
