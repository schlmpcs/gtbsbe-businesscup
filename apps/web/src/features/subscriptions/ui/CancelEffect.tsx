'use client';

// What stopping the ticked subscriptions does to the person's plan: the saving in one sentence, then the
// engine's plan() with and without it (net worth by year 10 and at retirement) and "Add to my plan". Shown
// on the findings and on the cancel plan once something is ticked. The tool never tells anyone to cancel.
import type { ComponentType, ReactNode } from 'react';
import { planImpact as pi, subscriptions as t } from '@/copy';
import { formatMoney } from '@/ui-kit';
import { PlanImpactPanel } from '@/ui-kit/reports';
import type { PlanImpactVM, PlanVM } from '../model/types';

export type CancelEffectProps = {
  plan: PlanVM;
  impact: PlanImpactVM;
  Link?: ComponentType<{ href: string; className?: string; children?: ReactNode }>;
};

export function CancelEffect({ plan, impact, Link }: CancelEffectProps) {
  if (plan.saving === null) return null;
  const lead = (
    <p data-testid="cancel-saving" className="font-semibold">
      {t.findings.saveLine(plan.markedCount, formatMoney(plan.saving.yearly), formatMoney(plan.saving.monthly))}
    </p>
  );
  return (
    <div className="flex flex-col gap-sm">
      {impact.status === 'ready' ? (
        <PlanImpactPanel
          data-testid="cancel-impact"
          lead={lead}
          in10y={impact.in10y}
          atRetirement={impact.atRetirement}
          year10={impact.year10}
          retireAge={impact.retireAge}
          scenarioName={impact.scenarioName}
          isSample={impact.isSample}
          state={impact.state}
          onAdd={impact.add}
          onRemove={impact.remove}
          planHref={impact.planHref}
          Link={Link}
        />
      ) : (
        <>
          {lead}
          {impact.status === 'error' && (
            <p role="alert" className="text-sm">
              {pi.error}
            </p>
          )}
        </>
      )}
      {!plan.profileCovers && (
        <p role="note" className="rounded-lg bg-surface-strong p-md text-sm">
          {t.plan.notCovered(formatMoney(plan.profileSubscriptions.value))}
        </p>
      )}
    </div>
  );
}
