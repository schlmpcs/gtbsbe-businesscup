'use client';

// Step 2: the catalogue by category, each service tickable, with its plan where there is a choice.
// Every price shows its year, its source and an estimate tag. A running total stays on screen.
import { useId } from 'react';
import { subscriptions as t } from '@/copy';
import { Button, Card, cx, EstimateTag, formatMoney, Row, SourceNote, Stack } from '@/ui-kit';
import type { TickServiceVM, TicksVM } from '../model/types';

export type TickListProps = { ticks: TicksVM; canReveal: boolean; onNext: () => void };

export function TickList({ ticks, canReveal, onNext }: TickListProps) {
  return (
    <Card title={t.ticks.title}>
      <Stack gap="xl">
        <p className="text-sm text-text-muted">{t.ticks.hint}</p>
        {ticks.groups.map((group) => (
          <section key={group.category} aria-labelledby={`tick-group-${group.category}`} className="flex flex-col gap-sm">
            <h3 id={`tick-group-${group.category}`} className="text-base font-semibold">
              {t.ticks.categories[group.category]}
            </h3>
            <ul className="flex flex-col gap-sm">
              {group.services.map((service) => (
                <TickRow key={service.serviceId} service={service} toggle={ticks.toggle} />
              ))}
            </ul>
          </section>
        ))}
        <div
          role="status"
          aria-live="polite"
          className="sticky bottom-0 flex flex-wrap items-center justify-between gap-md rounded-lg bg-surface-strong p-lg"
        >
          <div className="flex flex-col gap-xs">
            <p className="text-sm font-semibold">{t.ticks.totalTitle}</p>
            {ticks.count === 0 ? (
              <p className="text-sm text-text-muted">{t.ticks.empty}</p>
            ) : (
              <>
                <p className="text-lg font-bold tabular-nums">
                  {t.ticks.totalMonthly(formatMoney(ticks.monthly, { cents: true }))}
                  <span className="ml-sm text-sm font-normal text-text-muted">
                    {t.ticks.totalYearly(formatMoney(ticks.yearly, { cents: true }))}
                  </span>
                </p>
                <p className="flex flex-wrap items-center gap-sm text-xs text-text-muted">
                  {t.ticks.count(ticks.count)} · {t.ticks.totalNote} <EstimateTag />
                </p>
              </>
            )}
          </div>
          <Button disabled={!canReveal} onClick={onNext}>
            {t.ticks.next}
          </Button>
        </div>
      </Stack>
    </Card>
  );
}

function TickRow({ service, toggle }: { service: TickServiceVM; toggle: TicksVM['toggle'] }) {
  const checkId = useId();
  const planId = useId();
  const { plan } = service;
  return (
    <li
      className={cx(
        'flex flex-col gap-sm rounded-lg border-2 bg-surface p-md',
        service.ticked ? 'border-ink' : 'border-border',
      )}
    >
      <Row gap="md" justify="between" align="start" wrap={false}>
        <div className="flex min-w-0 items-start gap-md">
          <input
            id={checkId}
            type="checkbox"
            checked={service.ticked}
            onChange={() => toggle(service.serviceId, plan.id)}
            className="mt-xs size-5 shrink-0 accent-primary"
          />
          <label htmlFor={checkId} className="min-w-0 cursor-pointer text-base font-medium">
            {service.name}
          </label>
        </div>
        <p className="shrink-0 text-right text-sm tabular-nums">
          {formatMoney(plan.price, { cents: true })}
          <span className="text-text-muted"> {plan.cadence === 'monthly' ? '/mo' : plan.cadence === 'yearly' ? '/yr' : '/qtr'}</span>
        </p>
      </Row>
      <div className="flex flex-wrap items-center gap-sm pl-2xl text-xs text-text-muted">
        <span>{t.ticks.price(formatMoney(plan.price, { cents: true }), plan.cadence, service.priceYear)}</span>
        {plan.cadence !== 'monthly' && <span>({t.ticks.perMonth(formatMoney(plan.monthly, { cents: true }))})</span>}
        {service.isEstimate && <EstimateTag />}
      </div>
      {service.plans.length > 1 && (
        <div className="flex flex-wrap items-center gap-sm pl-2xl">
          <label htmlFor={planId} className="sr-only">
            {t.ticks.planLabel(service.name)}
          </label>
          <select
            id={planId}
            value={plan.id}
            onChange={(e) => toggle(service.serviceId, e.target.value)}
            className="rounded-md border-2 border-border bg-bg px-md py-xs text-sm"
          >
            {service.plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {formatMoney(p.price, { cents: true })}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="pl-2xl">
        <SourceNote source={service.source} variant="toggle" />
      </div>
    </li>
  );
}
