'use client';

// S21 Subscription audit (`/tools/subscriptions`): guess → ticks → reveal → statement → findings → plan.
// Placeholder UI: tokens and copy only. All data and actions come from useSubscriptions(); nothing is
// computed here. The designer's frames (docs/design/08-subscription-audit.md) replace it later.
import { subscriptions as t } from '@/copy';
import { PageHeader, Stack } from '@/ui-kit';
import type { SubscriptionsVM } from '../model/types';
import { CancelPlan } from './CancelPlan';
import { FindingsList } from './FindingsList';
import { GuessStep } from './GuessStep';
import { KeepNote } from './KeepNote';
import { RevealCard } from './RevealCard';
import { StepNav } from './StepNav';
import { TickList } from './TickList';
import { UploadStep } from './UploadStep';

export function SubscriptionsScreen({ vm }: { vm: SubscriptionsVM }) {
  return (
    <main className="mx-auto w-full max-w-(--container-2xl) px-lg py-xl">
      <Stack gap="xl">
        <PageHeader title={t.screens.S21} intro={t.intro} />
        {vm.status === 'loading' ? (
          <p role="status" className="text-sm text-text-muted">
            {t.loading}
          </p>
        ) : (
          <>
            <StepNav steps={vm.steps} current={vm.step} onGo={vm.goTo} />
            {vm.step === 'guess' && <GuessStep guess={vm.guess} onNext={vm.next} />}
            {vm.step === 'ticks' && <TickList ticks={vm.ticks} canReveal={vm.canReveal} onNext={() => vm.goTo('reveal')} />}
            {vm.step === 'reveal' && (
              <RevealCard reveal={vm.reveal} onFindForgotten={() => vm.goTo('statement')} onBack={() => vm.goTo('ticks')} />
            )}
            {vm.step === 'statement' && <UploadStep statement={vm.statement} />}
            {vm.step === 'findings' && (
              <Stack gap="xl">
                <FindingsList findings={vm.findings} statement={vm.statement} onPlan={() => vm.goTo('plan')} />
                <UploadStep statement={vm.statement} />
              </Stack>
            )}
            {vm.step === 'plan' && <CancelPlan plan={vm.plan} apply={vm.apply} renewals={vm.renewals} />}
            <KeepNote hasLocalData={vm.hasLocalData} onClear={vm.clearLocalData} />
          </>
        )}
      </Stack>
    </main>
  );
}
