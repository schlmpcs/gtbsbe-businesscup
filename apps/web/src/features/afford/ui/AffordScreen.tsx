'use client';

// S11 Can I Afford It? Placeholder layout (Figma frames replace it); all data and actions come from useAfford().
import { afford as t } from '@/copy';
import { Stack } from '@/ui-kit';
import type { AffordVM } from '../model/types';
import { AffordResultPanel } from './AffordResultPanel';
import { Skeleton } from './controls';
import { PurchaseForm } from './PurchaseForm';
import { PurchaseParse } from './PurchaseParse';
import { Wishlist } from './Wishlist';

export function AffordScreen({ vm }: { vm: AffordVM }) {
  return (
    <main className="mx-auto w-full max-w-(--container-2xl) px-lg py-xl">
      <h1 className="text-4xl leading-display sm:text-display">{t.screens.S11}</h1>
      <p className="mt-sm text-sm text-text-muted">{t.intro}</p>

      <div className="mt-xl">
        {vm.status === 'loading' ? (
          <Skeleton label={t.loading} rows={4} />
        ) : (
          <Stack gap="lg">
            <PurchaseParse parse={vm.parse} />
            <PurchaseForm
              form={vm.form}
              invalidFields={vm.invalidFields}
              setLabel={vm.setLabel}
              setAmount={vm.setAmount}
              setRecurring={vm.setRecurring}
              setPayWith={vm.setPayWith}
              setLoan={vm.setLoan}
            />
            <AffordResultPanel
              result={vm.result}
              rules={vm.rules}
              invalidFields={vm.invalidFields}
              purchaseLabel={vm.purchase?.label ?? t.defaultPurchaseLabel}
              chosenWay={vm.form.payWith}
            />
            <Wishlist
              wishlist={vm.wishlist}
              addToWishlist={vm.addToWishlist}
              removeFromWishlist={vm.removeFromWishlist}
              loadFromWishlist={vm.loadFromWishlist}
              wishlistLocked={vm.wishlistLocked}
              proHref={vm.proHref}
              canAdd={vm.purchase !== null}
            />
          </Stack>
        )}
      </div>
    </main>
  );
}
