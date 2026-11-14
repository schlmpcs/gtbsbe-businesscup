'use client';

// S11 Can I Afford It? (Figma Design v3, S11). All data and actions come from useAfford(); nothing is computed here.
import { afford as t } from '@/copy';
import { Stack } from '@/ui-kit';
import { useId, useState } from 'react';
import type { AffordVM } from '../model/types';
import { AffordEffects, AffordVerdictTile } from './AffordResultPanel';
import { Skeleton } from './controls';
import { PurchaseExamples, PurchaseForm } from './PurchaseForm';
import { PurchaseParse } from './PurchaseParse';
import { Wishlist, WishlistActions } from './Wishlist';

function Title() {
  return (
    <header className="flex flex-col gap-sm">
      <h1 className="font-display text-4xl font-extrabold leading-display tracking-tight sm:text-display">{t.screens.S11}</h1>
      <p className="text-lg text-text-muted">{t.intro}</p>
    </header>
  );
}

export function AffordScreen({ vm }: { vm: AffordVM }) {
  const [justAdded, setJustAdded] = useState(false);
  const formTitleId = useId();
  const ready = vm.result?.status === 'ready' ? vm.result.data : null;
  const cheaperWay = ready && ready.cheapestWay !== vm.form.payWith ? ready.cheapestWay : null;

  return (
    <main className="mx-auto w-full max-w-(--container-7xl) px-lg py-xl">
      {vm.status === 'loading' ? (
        <Stack gap="xl">
          <Title />
          <Skeleton label={t.loading} rows={4} />
        </Stack>
      ) : (
        <Stack gap="3xl">
          <div className="grid grid-cols-1 items-start gap-xl lg:grid-cols-[5fr_8fr]">
            <Stack gap="xl" className="min-w-0">
              <Title />
              <section aria-labelledby={formTitleId} className="flex flex-col gap-lg rounded-xl bg-surface p-xl shadow-md">
                <h2 id={formTitleId} className="text-xl font-bold leading-tight">
                  {t.form.title}
                </h2>
                <PurchaseParse parse={vm.parse} />
                <PurchaseExamples setLabel={vm.setLabel} setAmount={vm.setAmount} />
                <PurchaseForm
                  form={vm.form}
                  invalidFields={vm.invalidFields}
                  setLabel={vm.setLabel}
                  setAmount={vm.setAmount}
                  setRecurring={vm.setRecurring}
                  setPayWith={vm.setPayWith}
                  setLoan={vm.setLoan}
                />
              </section>
            </Stack>
            <Stack gap="xl" className="min-w-0">
              <AffordVerdictTile
                result={vm.result}
                rules={vm.rules}
                invalidFields={vm.invalidFields}
                chosenWay={vm.form.payWith}
              />
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
            </Stack>
          </div>
          <AffordEffects result={vm.result} purchaseLabel={vm.purchase?.label ?? t.defaultPurchaseLabel} />
          <Wishlist
            wishlist={vm.wishlist}
            removeFromWishlist={vm.removeFromWishlist}
            loadFromWishlist={vm.loadFromWishlist}
            onLoad={() => setJustAdded(false)}
          />
          <p className="text-xs text-text-muted">{t.footnote}</p>
        </Stack>
      )}
    </main>
  );
}
