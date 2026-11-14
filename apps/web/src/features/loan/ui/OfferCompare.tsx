'use client';

import { loan as t } from '@/copy';
import { cx, formatMoney, formatRate, Money, Sticker } from '@/ui-kit';
import type { ReactNode } from 'react';
import type { LoanLabVM, LoanOfferVM, LoanResult } from '../model/types';

type MetricRow = { key: string; label: string; hint?: string };

/** The table columns after the monthly payment (screen-reader headers; each tile shows them inline). */
const ROWS: MetricRow[] = [
  { key: 'totalInterest', label: t.compare.rows.totalInterest },
  { key: 'totalCost', label: t.compare.rows.totalCost, hint: t.compare.totalCostHint },
  { key: 'payoff', label: t.compare.rows.payoff },
  { key: 'debtLoad', label: t.compare.rows.debtLoad },
];

function placeholder(offer: LoanOfferVM): string {
  return offer.invalidFields.length > 0 ? t.compare.invalid : t.compare.failed;
}

/** A cream box with a small label over the value, like an input (Figma S12 "Amount / APR / Term"). */
function TermBox({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex min-w-0 flex-col gap-xs">
      <span className="text-xs font-medium text-text-muted">{label}</span>
      <span className="truncate rounded-md bg-bg px-md py-sm text-base font-bold tabular-nums">{value}</span>
    </span>
  );
}

/** "Paid off in · 36 months" style row under the bold line. */
function SmallRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <td className="flex basis-full items-baseline justify-between gap-md text-sm">
      <span aria-hidden="true" className="text-text-muted">
        {label}
      </span>
      <span className="text-right font-semibold tabular-nums">{children}</span>
    </td>
  );
}

function Metrics({ r }: { r: LoanResult }) {
  return (
    <>
      <td className="flex basis-full flex-wrap items-baseline gap-x-sm">
        <span className="font-display text-display font-extrabold leading-display tabular-nums">
          <Money value={r.monthly} />
        </span>
        <span aria-hidden="true" className="text-lg text-text-muted">
          {t.compare.perMonth}
        </span>
      </td>
      <td className="text-base font-bold tabular-nums">
        <Money value={r.totalInterest} /> {t.compare.inline.totalInterest}
      </td>
      <td className="text-base font-bold tabular-nums">
        <span aria-hidden="true" className="mr-sm">
          ·
        </span>
        <Money value={r.totalCost} /> {t.compare.inline.totalCost}
      </td>
      <SmallRow label={t.compare.rows.payoff}>
        {r.payoffMonth === null ? <span className="text-negative">{t.compare.never}</span> : t.compare.payoffMonths(r.payoffMonth)}
      </SmallRow>
      <SmallRow label={t.compare.rows.debtLoad}>{formatRate(r.debtLoadAfter)}</SmallRow>
    </>
  );
}

export type OfferCompareProps = Pick<LoanLabVM, 'offers' | 'selectedOfferId' | 'selectOffer'>;

/**
 * Up to 3 offers side by side (Figma Design v3 S12): one white card per offer with its terms in cream
 * boxes, the monthly payment in huge type, then interest · total, payoff and debt load. The cheapest
 * overall gets an orange inset border and a tilted "Least overall" sticker. It is a real table (one row
 * per offer) laid out as cards, so screen readers still get the row and column headers.
 */
export function OfferCompare({ offers, selectedOfferId, selectOffer }: OfferCompareProps) {
  const never = offers.filter((o) => o.result !== null && o.result.payoffMonth === null);
  const name = (o: LoanOfferVM) => t.offerName(offers.indexOf(o) + 1);

  return (
    <section aria-label={t.compare.title} className="flex flex-col gap-lg">
      {never.length > 0 && (
        <div role="alert" className="flex flex-col gap-xs rounded-xl bg-surface p-lg text-sm font-semibold text-negative shadow-md">
          {never.map((o) => (
            <p key={o.id}>{t.neverPaysOff(name(o))}</p>
          ))}
        </div>
      )}
      <table className="block w-full" data-testid="loan-compare">
        <caption className="sr-only">{t.compare.caption}</caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">{t.compare.metric}</th>
            <th scope="col">{t.compare.rows.monthly}</th>
            {ROWS.map((row) => (
              <th key={row.key} scope="col">
                {row.label}
                {row.hint && <span>. {row.hint}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="grid grid-cols-1 gap-xl pt-lg md:grid-cols-2 lg:grid-cols-3">
          {offers.map((o) => {
            const selected = o.id === selectedOfferId;
            const { input } = o;
            const extras = [
              input.downPayment ? t.terms.down(formatMoney(input.downPayment)) : null,
              input.fees ? t.terms.fees(formatMoney(input.fees)) : null,
            ].filter((x): x is string => x !== null);
            return (
              <tr
                key={o.id}
                className={cx(
                  'relative flex min-w-0 flex-wrap content-start items-baseline gap-x-sm gap-y-md rounded-xl bg-surface p-xl transition-shadow',
                  o.isLowestCost && 'ring-4 ring-primary ring-inset',
                  selected ? 'shadow-lg' : 'shadow-md',
                )}
              >
                <th scope="row" className="flex basis-full flex-col items-stretch gap-md text-left font-normal">
                  {(o.isLowestCost || o.isLowestMonthly) && (
                    <span className="absolute -top-lg right-lg flex flex-col items-end gap-xs">
                      {o.isLowestCost && (
                        <Sticker tone="primary" tilt={-5} className="px-lg! py-sm! text-sm! shadow-md">
                          {t.compare.lowestCost}
                        </Sticker>
                      )}
                      {o.isLowestMonthly && (
                        <Sticker tone="ink" tilt={3}>
                          {t.compare.lowestMonthly}
                        </Sticker>
                      )}
                    </span>
                  )}
                  <span className="flex flex-wrap items-center gap-sm">
                    <button
                      type="button"
                      aria-pressed={selected}
                      aria-label={t.compare.select(name(o))}
                      onClick={() => selectOffer(o.id)}
                      className={cx(
                        'rounded-lg font-display text-3xl font-extrabold leading-tight transition-colors',
                        'text-text hover:text-primary',
                      )}
                    >
                      {name(o)}
                    </button>
                    {selected && (
                      <span aria-hidden="true" className="rounded-full bg-ink px-sm text-xs font-bold leading-normal text-on-primary">
                        {t.compare.selected}
                      </span>
                    )}
                  </span>
                  <span className="grid grid-cols-3 gap-sm">
                    <TermBox label={t.compare.boxes.amount} value={formatMoney(input.amount)} />
                    <TermBox label={t.compare.boxes.apr} value={formatRate(input.apr, 2)} />
                    <TermBox label={t.compare.boxes.term} value={t.compare.termShort(input.termMonths)} />
                  </span>
                  {extras.length > 0 && <span className="text-xs text-text-muted">{extras.join(' · ')}</span>}
                </th>
                {o.result ? (
                  <Metrics r={o.result} />
                ) : (
                  <td colSpan={ROWS.length + 1} className="basis-full rounded-lg bg-bg p-md text-sm text-text-muted">
                    {placeholder(o)}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
