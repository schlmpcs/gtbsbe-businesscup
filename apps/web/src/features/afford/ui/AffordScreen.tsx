'use client';

// S11 Can I Afford It? (Figma S11). All data and actions come from useAfford(); nothing is computed here.
import { afford as t } from '@/copy';
import { Card, PageHeader, Stack } from '@/ui-kit';
import type { AffordVM } from '../model/types';
import { AffordEffects, AffordVerdictTile } from './AffordResultPanel';
import { Skeleton } from './controls';
import { PurchaseExamples, PurchaseForm } from './PurchaseForm';
import { PurchaseParse } from './PurchaseParse';
import { Wishlist } from './Wishlist';

export function AffordScreen({ vm }: { vm: AffordVM }) {
  return (
    <main className="mx-auto w-full max-w-(--container-7xl) px-lg py-xl">
      {vm.status === 'loading' ? (
        <Stack gap="xl">
          <PageHeader title={t.screens.S11} intro={t.intro} />
          <Skeleton label={t.loading} rows={4} />
        </Stack>
      ) : (
        <Stack gap="2xl">
          <div className="grid grid-cols-1 items-start gap-2xl lg:grid-cols-[7fr_5fr]">
            <Stack gap="xl" className="min-w-0">
              <PageHeader title={t.screens.S11} intro={t.intro} />
              <Card title={t.form.title} headingLevel={2}>
                <Stack gap="lg">
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
                </Stack>
              </Card>
            </Stack>
            <div className="min-w-0 lg:pt-2xl">
              <AffordVerdictTile
                result={vm.result}
                rules={vm.rules}
                invalidFields={vm.invalidFields}
                chosenWay={vm.form.payWith}
              />
            </div>
          </div>
          <AffordEffects result={vm.result} purchaseLabel={vm.purchase?.label ?? t.defaultPurchaseLabel} />
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
    </main>
  );
}
