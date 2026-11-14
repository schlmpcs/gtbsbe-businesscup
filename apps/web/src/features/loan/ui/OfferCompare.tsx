'use client';

import { loan as t } from '@/copy';
import { cx, formatRate, Money, Sticker } from '@/ui-kit';
import type { ReactNode } from 'react';
import type { LoanLabVM, LoanOfferVM, LoanResult } from '../model/types';

type MetricRow = { key: string; label: string; hint?: string; cell: (r: LoanResult) => ReactNode };

/** The rows under the big monthly payment on each tile (label left, value right). */
const ROWS: MetricRow[] = [
  { key: 'totalInterest', label: t.compare.rows.totalInterest, cell: (r) => <Money value={r.totalInterest} /> },
  { key: 'totalCost', label: t.compare.rows.totalCost, hint: t.compare.totalCostHint, cell: (r) => <Money value={r.totalCost} /> },
  {
    key: 'payoff',
    label: t.compare.rows.payoff,
    cell: (r) =>
      r.payoffMonth === null ? (
        <span className="font-semibold text-negative">{t.compare.never}</span>
      ) : (
        t.compare.payoffMonths(r.payoffMonth)
      ),
  },
  { key: 'debtLoad', label: t.compare.rows.debtLoad, cell: (r) => formatRate(r.debtLoadAfter) },
];

/** Slight decorative tilts, like the tiles in the Figma frame. */
const TILTS = [-0.6, 0.5, -0.3];

function placeholder(offer: LoanOfferVM): string {
  return offer.invalidFields.length > 0 ? t.compare.invalid : t.compare.failed;
}

export type OfferCompareProps = Pick<LoanLabVM, 'offers' | 'selectedOfferId' | 'selectOffer'>;

/**
 * Up to 3 offers side by side (Figma S12): one tile per offer with the monthly payment in huge type,
 * then interest, total cost, payoff and debt load. It is a real table (one row per offer) laid out
 * as tiles, so screen readers still get the row and column headers.
 */
export function OfferCompare({ offers, selectedOfferId, selectOffer }: OfferCompareProps) {
  const never = offers.filter((o) => o.result !== null && o.result.payoffMonth === null);
  const name = (o: LoanOfferVM) => t.offerName(offers.indexOf(o) + 1);

  return (
    <section aria-label={t.compare.title} className="flex flex-col gap-lg">
      {never.length > 0 && (
        <div role="alert" className="flex flex-col gap-xs rounded-lg border-2 border-negative bg-surface p-md text-sm text-negative">
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
          {offers.map((o, i) => {
            const selected = o.id === selectedOfferId;
            return (
              <tr
                key={o.id}
                style={{ transform: `rotate(${TILTS[i % TILTS.length]}deg)` }}
                className={cx(
                  'relative flex min-w-0 flex-col gap-md rounded-xl border-2 bg-surface p-xl transition-shadow',
                  o.isLowestCost ? 'border-positive' : 'border-transparent',
                  selected ? 'shadow-lg' : 'shadow-md',
                )}
              >
                <th scope="row" className="flex flex-col items-start gap-sm text-left font-normal">
                  {(o.isLowestCost || o.isLowestMonthly) && (
                    <span className="absolute -top-lg right-lg flex flex-col items-end gap-xs">
                      {o.isLowestCost && (
                        <Sticker tone="positive" tilt={-4} className="px-md py-xs text-sm">
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
                  <button
                    type="button"
                    aria-pressed={selected}
                    aria-label={t.compare.select(name(o))}
                    onClick={() => selectOffer(o.id)}
                    className={cx(
                      'rounded-full border-2 px-md py-xs text-sm font-bold transition-colors',
                      selected ? 'border-ink bg-ink text-on-primary' : 'border-border text-text hover:border-text',
                    )}
                  >
                    {name(o)}
                  </button>
                  <span className="text-lg font-semibold">{t.compare.offerTerms(o.input.termMonths, formatRate(o.input.apr))}</span>
                </th>
                {o.result ? (
                  <>
                    <td className="flex flex-wrap items-baseline gap-x-sm">
                      <span className="font-display text-display font-extrabold leading-display tabular-nums">
                        <Money value={o.result.monthly} />
                      </span>
                      <span aria-hidden="true" className="text-text-muted">
                        {t.compare.perMonth}
                      </span>
                    </td>
                    {ROWS.map((row) => (
                      <td key={row.key} className="flex items-baseline justify-between gap-md text-sm">
                        <span aria-hidden="true" className="text-text-muted">
                          {row.label}
                        </span>
                        <span className={cx('text-right tabular-nums', selected ? 'font-bold' : 'font-semibold')}>
                          {row.cell(o.result!)}
                        </span>
                      </td>
                    ))}
                  </>
                ) : (
                  <td colSpan={ROWS.length + 1} className="rounded-lg bg-surface-strong p-md text-sm text-text-muted">
                    {placeholder(o)}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-xs text-text-muted">{t.compare.totalCostHint}</p>
    </section>
  );
}
