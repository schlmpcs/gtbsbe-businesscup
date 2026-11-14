'use client';

// S12 Loan Lab. Placeholder layout (Figma frames replace it); all numbers come from useLoanLab(),
// which calls the engine's loan / compareLoans. Nothing is computed here.
import { loan as t } from '@/copy';
import { Stack } from '@/ui-kit';
import type { LoanLabVM } from '../model/types';
import { DebtLoadGauges } from './DebtLoadGauges';
import { ExtraPayment } from './ExtraPayment';
import { LoanParse } from './LoanParse';
import { OfferCompare } from './OfferCompare';
import { OfferEditor } from './OfferEditor';

function Loading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-md">
      <span className="sr-only">{t.loading}</span>
      <div aria-hidden="true" className="h-3xl animate-pulse rounded-lg bg-surface" />
      <div aria-hidden="true" className="h-2xl animate-pulse rounded-lg bg-surface" />
      <div aria-hidden="true" className="h-2xl animate-pulse rounded-lg bg-surface" />
    </div>
  );
}

export function LoanLabScreen({ vm }: { vm: LoanLabVM }) {
  const selectedIndex = vm.offers.findIndex((o) => o.id === vm.selectedOfferId);
  const selectedName = selectedIndex >= 0 ? t.offerName(selectedIndex + 1) : null;

  return (
    <main className="mx-auto w-full max-w-(--container-2xl) px-lg py-xl">
      <h1 className="text-2xl font-semibold leading-tight">
        <span className="text-text-muted">S12</span> {t.screens.S12}
      </h1>
      <p className="mt-sm text-sm text-text-muted">{t.intro}</p>

      <div className="mt-xl">
        {vm.status === 'loading' ? (
          <Loading />
        ) : (
          <Stack gap="lg">
            {vm.offers.length > 0 && (
              <OfferCompare offers={vm.offers} selectedOfferId={vm.selectedOfferId} selectOffer={vm.selectOffer} />
            )}
            <DebtLoadGauges gauge={vm.gauge} selectedName={selectedName} />
            <ExtraPayment extra={vm.extra} setExtraPayment={vm.setExtraPayment} selectedName={selectedName} />
            <OfferEditor
              offers={vm.offers}
              selectedOfferId={vm.selectedOfferId}
              selectOffer={vm.selectOffer}
              updateOffer={vm.updateOffer}
              removeOffer={vm.removeOffer}
              addOffer={vm.addOffer}
              canAddOffer={vm.canAddOffer}
            />
            <LoanParse parse={vm.parse} canAddOffer={vm.canAddOffer} />
          </Stack>
        )}
      </div>
    </main>
  );
}
