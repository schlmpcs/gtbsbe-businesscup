'use client';

// Step 6: mark what would stop, see the saving per month, per year and over 10 years (the same
// forecast as Next Moves, with its source label), add it as the next move, put the total in the plan,
// and take the renewals to a calendar. The tool never tells anyone to cancel a particular service.
import { useState } from 'react';
import { forecast as forecastCopy, subscriptions as t } from '@/copy';
import { Button, Card, EstimateTag, formatMoney, Money, Row, Stack, Stat, Tag } from '@/ui-kit';
import type { ApplyVM, PlanVM, RenewalsVM } from '../model/types';
import { UseInPlanSheet } from './UseInPlanSheet';

export type CancelPlanProps = { plan: PlanVM; apply: ApplyVM; renewals: RenewalsVM };

export function CancelPlan({ plan, apply, renewals }: CancelPlanProps) {
  const [confirming, setConfirming] = useState(false);
  const money = (n: number) => formatMoney(n, { cents: true });
  return (
    <Stack gap="xl">
      <Card title={t.plan.title}>
        <Stack gap="lg">
          <p className="text-sm text-text-muted">{t.plan.intro}</p>

          <fieldset className="flex flex-col gap-sm">
            <legend className="mb-sm text-sm font-semibold">{t.plan.options}</legend>
            {plan.options.map((option) => (
              <label
                key={option.id}
                className="flex cursor-pointer items-center justify-between gap-md rounded-lg border-2 border-border bg-surface p-md has-checked:border-ink"
              >
                <span className="flex min-w-0 items-center gap-md">
                  <input
                    type="checkbox"
                    checked={option.markedCancel}
                    onChange={() => (option.markedCancel ? plan.unmarkCancel(option.id) : plan.markCancel(option.id))}
                    aria-label={t.plan.mark(option.name)}
                    className="size-5 shrink-0 accent-primary"
                  />
                  <span className="min-w-0 break-words text-base">{option.name}</span>
                  {option.isEstimate && <EstimateTag />}
                </span>
                <span className="shrink-0 text-sm tabular-nums">{t.plan.perMonth(money(option.monthly))}</span>
              </label>
            ))}
          </fieldset>

          {plan.saving === null ? (
            <p className="text-sm text-text-muted">{t.plan.empty}</p>
          ) : (
            <div className="grid grid-cols-1 gap-lg sm:grid-cols-3" aria-live="polite">
              <Stat
                label={t.plan.marked(plan.markedCount)}
                value={<Money value={plan.saving.monthly} cents />}
                hint={t.plan.perMonth(money(plan.saving.monthly))}
                isEstimate={plan.saving.isEstimate}
              />
              <Stat
                label={t.plan.yearLabel}
                value={<Money value={plan.saving.yearly} cents />}
                hint={t.plan.perYear(money(plan.saving.yearly))}
                isEstimate={plan.saving.isEstimate}
              />
              <Effect plan={plan} />
            </div>
          )}

          {plan.saving !== null && !plan.profileCovers && (
            <p role="note" className="rounded-lg bg-surface-strong p-md text-sm">
              {t.plan.notCovered(money(plan.profileSubscriptions.value))}
            </p>
          )}
          {plan.saving !== null && plan.isSampleProfile && <p className="text-xs text-text-muted">{t.plan.sampleProfile}</p>}
          {plan.moveOutdated && <p role="note" className="text-xs text-text-muted">{t.plan.moveOutdated}</p>}

          <Row gap="sm">
            {plan.moveAdded ? (
              <Tag>{t.plan.moveAdded}</Tag>
            ) : (
              <Button disabled={!plan.canAddAsMove} onClick={plan.addAsMove}>
                {plan.moveOutdated ? t.plan.updateMove : t.plan.addAsMove}
              </Button>
            )}
            {apply.inPlan ? (
              <Tag>{t.plan.inPlan}</Tag>
            ) : (
              <Button variant="secondary" disabled={!apply.canApply} onClick={() => setConfirming(true)}>
                {t.plan.useInPlan}
              </Button>
            )}
          </Row>
        </Stack>
      </Card>

      <Card title={t.renewals.title} headingLevel={2} tone="muted">
        <Stack gap="md">
          <p className="text-sm">{renewals.canExport ? t.renewals.body(renewals.count) : t.renewals.none}</p>
          {renewals.canExport && (
            <>
              <Row gap="sm">
                <Button variant="secondary" onClick={renewals.exportCalendar}>
                  {t.renewals.button}
                </Button>
                {renewals.outcome !== null && (
                  <p role="status" className="text-sm">
                    {t.renewals.outcome[renewals.outcome]}
                  </p>
                )}
              </Row>
              <p className="text-xs text-text-muted">{t.renewals.builtHere}</p>
              <p className="text-xs text-text-muted">{t.renewals.importOnce}</p>
              <p className="text-xs text-text-muted">{t.renewals.reminders}</p>
            </>
          )}
        </Stack>
      </Card>

      <UseInPlanSheet
        open={confirming}
        apply={apply}
        onClose={() => setConfirming(false)}
        onConfirm={() => {
          apply.applyToProfile();
          setConfirming(false);
        }}
      />
    </Stack>
  );
}

/** The 10-year effect, with who measured it. */
function Effect({ plan }: { plan: PlanVM }) {
  const effect = plan.effect;
  if (effect === null) return null;
  if (effect.status === 'loading') return <p role="status" className="self-center text-sm text-text-muted">{t.plan.loading}</p>;
  if (effect.status === 'error') return <p role="alert" className="self-center text-sm">{t.plan.error}</p>;
  if (effect.data.effect10y <= 0) return <p className="self-center text-sm text-text-muted">{t.plan.tooSmall}</p>;
  return (
    <Stat
      label={t.plan.in10y}
      value={<Money value={effect.data.effect10y} />}
      hint={
        <>
          {t.plan.todaysDollars} <Tag className="ml-xs">{forecastCopy.source[effect.data.source]}</Tag>
        </>
      }
    />
  );
}
