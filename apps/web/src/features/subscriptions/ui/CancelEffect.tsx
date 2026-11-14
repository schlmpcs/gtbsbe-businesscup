'use client';

// The measured part of the cancel plan: the 10-year number with who measured it, the notes that qualify
// it, and "add as my next move". It is the slot content of CancelPlan, so a screen mounts it (and with it
// the forecast request) only while something is marked.
import { forecast as forecastCopy, subscriptions as t } from '@/copy';
import { Button, formatMoney, Money, Row, Stack, Stat, Tag } from '@/ui-kit';
import type { CancelResultVM, PlanVM } from '../model/types';

export type CancelEffectProps = { plan: PlanVM; result: CancelResultVM };

export function CancelEffect({ plan, result }: CancelEffectProps) {
  const effect = result.effect;
  return (
    <Stack gap="md">
      <div aria-live="polite">
        {effect === null || effect.status === 'loading' ? (
          <p role="status" className="text-sm text-text-muted">
            {t.plan.loading}
          </p>
        ) : effect.status === 'error' ? (
          <p role="alert" className="text-sm">
            {t.plan.error}
          </p>
        ) : effect.data.effect10y <= 0 ? (
          <p className="text-sm text-text-muted">{t.plan.tooSmall}</p>
        ) : (
          <Stat
            label={t.plan.in10y}
            value={<Money value={effect.data.effect10y} />}
            hint={
              <>
                {t.plan.todaysDollars} <Tag className="ml-xs">{forecastCopy.source[effect.data.source]}</Tag>
              </>
            }
          />
        )}
      </div>

      {!plan.profileCovers && (
        <p role="note" className="rounded-lg bg-surface-strong p-md text-sm">
          {t.plan.notCovered(formatMoney(plan.profileSubscriptions.value, { cents: true }))}
        </p>
      )}
      {plan.isSampleProfile && <p className="text-xs text-text-muted">{t.plan.sampleProfile}</p>}
      {plan.moveOutdated && (
        <p role="note" className="text-xs text-text-muted">
          {t.plan.moveOutdated}
        </p>
      )}

      <Row gap="sm">
        {plan.moveAdded ? (
          <Tag>{t.plan.moveAdded}</Tag>
        ) : (
          <Button disabled={!result.canAddAsMove} onClick={result.addAsMove}>
            {plan.moveOutdated ? t.plan.updateMove : t.plan.addAsMove}
          </Button>
        )}
      </Row>
    </Stack>
  );
}
