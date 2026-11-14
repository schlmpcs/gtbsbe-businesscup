'use client';

// S12 Loan Lab (Figma S12). All numbers come from useLoanLab(), which calls the engine's loan /
// compareLoans / payoffOrder. Nothing is computed here.
import { loan as t } from '@/copy';
import { Art, formatMoney, Stack } from '@/ui-kit';
import type { LoanLabVM } from '../model/types';
import { DebtLoadGauges } from './DebtLoadGauges';
import { ExtraPayment } from './ExtraPayment';
import { LoanParse } from './LoanParse';
import { OfferCompare } from './OfferCompare';
import { OfferEditor } from './OfferEditor';
import { PayoffOrder } from './PayoffOrder';

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

const chip = 'rounded-full border-2 border-border bg-surface px-lg py-sm text-base font-medium tabular-nums';

export function LoanLabScreen({ vm }: { vm: LoanLabVM }) {
  const selectedIndex = vm.offers.findIndex((o) => o.id === vm.selectedOfferId);
  const selected = selectedIndex >= 0 ? vm.offers[selectedIndex]! : null;
  const selectedName = selected ? t.offerName(selectedIndex + 1) : null;
  const input = selected?.input ?? null;

  return (
    <main className="mx-auto w-full max-w-(--container-7xl) px-lg py-xl">
      <header className="grid grid-cols-1 items-start gap-xl lg:grid-cols-[1fr_auto]">
        <div className="flex min-w-0 flex-col gap-md">
          <h1 className="w-fit rounded-full bg-ink px-md py-xs font-sans text-xs font-bold uppercase tracking-wide text-on-primary">
            {t.screens.S12}
          </h1>
          {input && Number.isFinite(input.amount) ? (
            <p className="font-display text-4xl font-extrabold leading-display tracking-tight sm:text-display lg:text-[calc(var(--text-display)*1.6)]">
              {t.headline(formatMoney(input.amount))}
              <br />
              {t.ways(vm.offers.length)}
            </p>
          ) : null}
          <p className="max-w-prose text-lg text-text-muted">{t.intro}</p>
        </div>
        <div className="flex flex-col items-start gap-lg lg:items-end">
          {input && (
            <ul aria-label={t.terms.label} className="flex flex-wrap gap-sm lg:justify-end">
              {Number.isFinite(input.amount) && <li className={chip}>{t.terms.price(formatMoney(input.amount))}</li>}
              <li className={chip}>{t.terms.down(formatMoney(input.downPayment ?? 0))}</li>
              <li className={chip}>{t.terms.fees(formatMoney(input.fees ?? 0))}</li>
            </ul>
          )}
          <Art name="loan" framed tilt={4} className="w-1/2 max-w-(--container-3xs) lg:w-full" />
        </div>
      </header>

      <div className="mt-2xl">
        {vm.status === 'loading' ? (
          <Loading />
        ) : (
          <Stack gap="2xl">
            {vm.offers.length > 0 && (
              <OfferCompare offers={vm.offers} selectedOfferId={vm.selectedOfferId} selectOffer={vm.selectOffer} />
            )}
            <DebtLoadGauges gauge={vm.gauge} selectedName={selectedName} />
            <div className="grid grid-cols-1 items-start gap-xl lg:grid-cols-2">
              <ExtraPayment
                extra={vm.extra}
                setExtraPayment={vm.setExtraPayment}
                selectedName={selectedName}
                selectedMonthly={selected?.result?.monthly ?? null}
              />
              <PayoffOrder plan={vm.payoffPlan} selectedName={selectedName} />
            </div>
            <div className="grid grid-cols-1 items-start gap-xl lg:grid-cols-2">
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
            </div>
          </Stack>
        )}
      </div>
    </main>
  );
}
