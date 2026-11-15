'use client';

// "What it does to your plan": a What if? tool's change measured on the person's /plan (net worth in 10
// years and at retirement, with minus without), with "Add to my plan" → "Added to your plan · Open plan".
// Presentational: the numbers and actions come from the tool's view-model (the engine's plan()). `Link`
// is the router's link, so /plan opens without a reload (the plan keeps what was added).
import type { ComponentType, ReactNode } from 'react';
import { planImpact as t } from '@/copy';
import { buttonClassName } from '../Button';
import { cx } from '../cx';
import { formatMoney } from '../format';
import { Tag } from '../Tag';
import { CountUp } from './CountUp';
import { MOTION } from './tones';

type LinkLike = ComponentType<{ href: string; className?: string; children?: ReactNode }>;

export type PlanImpactPanelProps = {
  in10y: number;
  atRetirement: number;
  year10: number;
  retireAge: number;
  scenarioName: string;
  isSample: boolean;
  state: 'new' | 'added' | 'outdated';
  onAdd: () => void;
  onRemove?: () => void;
  planHref: string;
  Link?: LinkLike;
  /** What is added, said once above the numbers ("Cancel 2 subscriptions: save $360 a year"). */
  lead?: ReactNode;
  className?: string;
  'data-testid'?: string;
};

const A: LinkLike = ({ href, className, children }) => (
  <a href={href} className={className}>
    {children}
  </a>
);

const signed = (n: number) => formatMoney(n, { signed: true });

export function PlanImpactPanel({
  in10y, atRetirement, year10, retireAge, scenarioName, isSample, state, onAdd, onRemove, planHref, Link = A, lead, className, ...rest
}: PlanImpactPanelProps) {
  const tooSmall = Math.abs(in10y) < 1 && Math.abs(atRetirement) < 1;
  const tone = (n: number) => (n > 0 ? 'text-positive' : n < 0 ? 'text-negative' : 'text-text');
  return (
    <section
      aria-label={t.title}
      className={cx('flex flex-col gap-md rounded-(--card-radius) border border-border bg-surface p-lg sm:p-xl', MOTION.rise, className)}
      data-testid={rest['data-testid']}
    >
      <div className="flex flex-wrap items-center justify-between gap-sm">
        <h3 className="text-base font-bold">{t.title}</h3>
        <Tag>{t.source}</Tag>
      </div>
      {lead && <div className="text-sm">{lead}</div>}
      {tooSmall ? (
        <p className="text-sm text-text-muted">{t.tooSmall}</p>
      ) : (
        <dl className="grid grid-cols-2 gap-md" aria-live="polite">
          <div className="flex min-w-0 flex-col gap-xs">
            <dt className="text-xs text-text-muted">{t.in10y(year10)}</dt>
            <dd data-testid="impact-10y" className={cx('font-display text-2xl font-extrabold tabular-nums sm:text-3xl', tone(in10y))}>
              <CountUp value={in10y} format={signed} />
            </dd>
          </div>
          <div className="flex min-w-0 flex-col gap-xs">
            <dt className="text-xs text-text-muted">{t.atRetirement(retireAge)}</dt>
            <dd data-testid="impact-retirement" className={cx('font-display text-2xl font-extrabold tabular-nums sm:text-3xl', tone(atRetirement))}>
              <CountUp value={atRetirement} format={signed} />
            </dd>
          </div>
        </dl>
      )}
      <p className="text-xs text-text-muted">{t.hint(scenarioName)}</p>
      {isSample && <p className="text-xs text-text-muted">{t.sample}</p>}
      {state === 'outdated' && (
        <p role="note" className="text-xs text-text-muted">
          {t.outdated}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-sm">
        {state === 'added' ? (
          <>
            <span role="status" className="inline-flex min-h-11 items-center gap-xs text-sm font-semibold text-positive">
              <span aria-hidden="true">✓</span>
              {t.added}
            </span>
            <Link href={planHref} className={buttonClassName({ variant: 'primary' })}>
              {t.open} <span aria-hidden="true">→</span>
            </Link>
            {onRemove && (
              <button type="button" onClick={onRemove} className="min-h-11 px-sm text-sm font-semibold text-text-muted hover:underline">
                {t.remove}
              </button>
            )}
          </>
        ) : (
          <button type="button" onClick={onAdd} disabled={tooSmall} className={buttonClassName({ variant: 'primary' })}>
            {state === 'outdated' ? t.update : t.add}
          </button>
        )}
      </div>
    </section>
  );
}
