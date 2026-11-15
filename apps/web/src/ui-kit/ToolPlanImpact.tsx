'use client';

// "What it does to your plan" for the What if? tools: the engine's previewEvent on the active scenario
// (net worth at retirement and at the end of the plan, with vs without, and whether the money lasts),
// then "Add to my plan" → "Added to your plan · Open plan". Presentational: the numbers and the action
// come from the tool's view-model (useToolPlanEvent); `Link` is next/link in the app, so the plan store
// survives the move to /plan.
import type { ComponentType, ReactNode } from 'react';
import { toolPlan as t } from '@/copy';
import { Button, buttonClassName } from './Button';
import { cx } from './cx';
import { formatMoney } from './format';
import { CountUp } from './reports/CountUp';
import { KpiStrip, type KpiItem } from './reports/KpiStrip';
import { Tag } from './Tag';

type Kpis = { netWorthAtRetirement: number; retireAge: number; netWorthAtEnd: number; shortfallAge: number | null };

export type ToolPlanImpactProps = {
  scenarioName: string;
  /** null = nothing to measure yet (the card is not shown). */
  preview:
    | { status: 'loading' }
    | { status: 'error' }
    | {
        status: 'ready';
        data: {
          without: Kpis;
          withEvent: Kpis;
          deltaAtRetirement: number;
          deltaAtEnd: number;
          causesShortfall: boolean;
          endAge: number;
          display: 'today' | 'future';
        };
      }
    | null;
  add: () => unknown;
  added: boolean;
  planHref: string;
  /** What the event will be called on /plan ("Car, financed"). */
  what: string;
  Link: ComponentType<{ href: string; className?: string; children?: ReactNode }>;
  className?: string;
};

const signed = (v: number) => (Math.abs(v) < 1 ? t.noChange : t.vsWithout(formatMoney(v, { signed: true })));
const whole = (v: number) => formatMoney(v);

export function ToolPlanImpact({ scenarioName, preview, add, added, planHref, what, Link, className }: ToolPlanImpactProps) {
  if (!preview) return null;
  const data = preview.status === 'ready' ? preview.data : null;
  const items: KpiItem[] = data
    ? [
        {
          id: 'retirement',
          label: t.atRetirement(data.withEvent.retireAge),
          value: <CountUp value={data.withEvent.netWorthAtRetirement} format={whole} />,
          hint: <span className={data.deltaAtRetirement < -0.5 ? 'font-semibold text-negative' : undefined}>{signed(data.deltaAtRetirement)}</span>,
        },
        {
          id: 'end',
          label: t.atEnd(data.endAge),
          value: <CountUp value={data.withEvent.netWorthAtEnd} format={whole} />,
          hint: <span className={data.deltaAtEnd < -0.5 ? 'font-semibold text-negative' : undefined}>{signed(data.deltaAtEnd)}</span>,
        },
        {
          id: 'lasts',
          label: t.moneyLasts,
          value: data.withEvent.shortfallAge === null ? t.lastsTo(data.endAge) : t.runsOut(data.withEvent.shortfallAge),
          tone: data.withEvent.shortfallAge === null ? 'positive' : 'negative',
        },
      ]
    : [];

  return (
    <section aria-labelledby="tool-plan-impact-title" data-testid="tool-plan-impact" className={cx('card card-pad flex min-w-0 flex-col gap-lg', className)}>
      <div className="flex flex-wrap items-start justify-between gap-md">
        <div className="flex min-w-0 flex-col gap-xs">
          <h2 id="tool-plan-impact-title" className="text-lg font-bold leading-tight">
            {t.title}
          </h2>
          <p className="text-sm text-text-muted">{t.on(scenarioName)}</p>
        </div>
        <Tag>{t.source}</Tag>
      </div>
      {preview.status === 'loading' && <div aria-hidden="true" className="h-3xl animate-pulse rounded-lg bg-surface-strong" />}
      {preview.status === 'error' && (
        <p role="alert" className="text-sm">
          {t.error}
        </p>
      )}
      {data && (
        <>
          <KpiStrip items={items} aria-label={t.title} className="shadow-none" />
          {data.causesShortfall && data.withEvent.shortfallAge !== null && (
            <p className="rounded-lg bg-negative/10 p-md text-sm font-semibold text-negative">{t.causesShortfall(data.withEvent.shortfallAge)}</p>
          )}
          <p className="text-xs text-text-muted">{t.display[data.display]}</p>
        </>
      )}
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-text-muted">{t.willAdd(what)}</p>
        <div aria-live="polite" className="flex flex-wrap items-center gap-md">
          {added ? (
            <>
              <span data-testid="tool-plan-added" className="flex items-center gap-xs text-sm font-bold text-positive">
                <span aria-hidden="true">✓</span>
                {t.added}
              </span>
              <Link href={planHref} className={buttonClassName({ variant: 'secondary', size: 'md' })}>
                {t.open} <span aria-hidden="true">→</span>
              </Link>
            </>
          ) : (
            <Button data-testid="tool-plan-add" onClick={() => add()} disabled={!data}>
              {t.add}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
