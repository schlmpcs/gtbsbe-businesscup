'use client';

// "What am I still paying for?" (`/tools/subscriptions`): transactions or statement → findings (tick what
// you would stop, see what it does to your plan) → cancel plan; guess → ticks → reveal as the by-hand
// fallback. Tokens and copy only. All data and actions come from useSubscriptions() and usePlanImpact();
// nothing is computed here.
import type { ComponentType, ReactNode } from 'react';
import { subscriptions as t } from '@/copy';
import { Art, PageHeader, Stack } from '@/ui-kit';
import type { PlanImpactVM, SubscriptionsVM } from '../model/types';
import { CancelPlan } from './CancelPlan';
import { FindingsList } from './FindingsList';
import { GuessStep } from './GuessStep';
import { KeepNote } from './KeepNote';
import { RevealCard } from './RevealCard';
import { StepNav } from './StepNav';
import { TickList } from './TickList';
import { UploadStep } from './UploadStep';

const NO_IMPACT: PlanImpactVM = { status: 'none' };

export type SubscriptionsScreenProps = {
  vm: SubscriptionsVM;
  /** What the ticked cancel plan does to the person's plan (usePlanImpact). */
  impact?: PlanImpactVM;
  Link?: ComponentType<{ href: string; className?: string; children?: ReactNode }>;
};

export function SubscriptionsScreen({ vm, impact = NO_IMPACT, Link }: SubscriptionsScreenProps) {
  return (
    <main className="mx-auto w-full max-w-(--container-5xl) px-lg pb-3xl pt-md">
      <Stack gap="xl">
        <PageHeader
          eyebrow={t.eyebrow}
          title={t.screens.S21}
          intro={t.intro}
          aside={<Art name="streaming" className="hidden h-28 w-28 items-center sm:flex" />}
        />
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
            {vm.step === 'statement' && <UploadStep statement={vm.statement} onByHand={() => vm.goTo('guess')} />}
            {vm.step === 'findings' && (
              <Stack gap="xl">
                <FindingsList
                  findings={vm.findings}
                  statement={vm.statement}
                  canPlan={vm.steps.some((s) => s.id === 'plan' && s.available)}
                  onPlan={() => vm.goTo('plan')}
                  plan={vm.plan}
                  impact={impact}
                  Link={Link}
                />
                <UploadStep statement={vm.statement} />
              </Stack>
            )}
            {vm.step === 'plan' && <CancelPlan plan={vm.plan} apply={vm.apply} renewals={vm.renewals} impact={impact} Link={Link} />}
            <KeepNote hasLocalData={vm.hasLocalData} onClear={vm.clearLocalData} />
          </>
        )}
      </Stack>
    </main>
  );
}
