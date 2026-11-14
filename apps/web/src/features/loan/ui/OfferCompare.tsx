'use client';

import { loan as t } from '@/copy';
import { Card, cx, formatRate, Money } from '@/ui-kit';
import type { ReactNode } from 'react';
import type { LoanLabVM, LoanOfferVM, LoanResult } from '../model/types';

function Badge({ children, tone = 'positive' }: { children: ReactNode; tone?: 'positive' | 'negative' }) {
  return (
    <span
      className={cx(
        'inline-flex rounded-full px-sm text-xs font-semibold leading-normal',
        tone === 'positive' ? 'bg-surface text-positive' : 'bg-surface text-negative',
      )}
    >
      {children}
    </span>
  );
}

type Row = { key: string; label: string; hint?: string; cell: (r: LoanResult) => ReactNode };

const ROWS: Row[] = [
  { key: 'monthly', label: t.compare.rows.monthly, cell: (r) => <Money value={r.monthly} /> },
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

function placeholder(offer: LoanOfferVM): string {
  return offer.invalidFields.length > 0 ? t.compare.invalid : t.compare.failed;
}

export type OfferCompareProps = Pick<LoanLabVM, 'offers' | 'selectedOfferId' | 'selectOffer'>;

/** Up to 3 offers side by side: monthly, interest, total cost, payoff and debt load. */
export function OfferCompare({ offers, selectedOfferId, selectOffer }: OfferCompareProps) {
  const never = offers.filter((o) => o.result !== null && o.result.payoffMonth === null);
  const name = (o: LoanOfferVM) => t.offerName(offers.indexOf(o) + 1);

  return (
    <Card title={t.compare.title}>
      {never.length > 0 && (
        <div role="alert" className="mb-md flex flex-col gap-xs rounded-md border border-negative p-md text-sm text-negative">
          {never.map((o) => (
            <p key={o.id}>{t.neverPaysOff(name(o))}</p>
          ))}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-sm" data-testid="loan-compare">
          <caption className="sr-only">{t.compare.caption}</caption>
          <thead>
            <tr>
              <th scope="col" className="w-1/4 py-xs pr-sm text-left text-xs font-medium text-text-muted">
                <span className="sr-only">{t.compare.metric}</span>
              </th>
              {offers.map((o) => {
                const selected = o.id === selectedOfferId;
                return (
                  <th key={o.id} scope="col" className="py-xs pr-xs text-right align-bottom font-medium">
                    <div className="flex flex-col items-end gap-xs">
                      <button
                        type="button"
                        aria-pressed={selected}
                        aria-label={t.compare.select(name(o))}
                        onClick={() => selectOffer(o.id)}
                        className={cx(
                          'rounded-sm px-xs py-xs text-sm font-semibold',
                          selected ? 'bg-primary text-on-primary' : 'text-primary hover:bg-surface',
                        )}
                      >
                        {name(o)}
                      </button>
                      {o.isLowestCost && <Badge>{t.compare.lowestCost}</Badge>}
                      {o.isLowestMonthly && <Badge>{t.compare.lowestMonthly}</Badge>}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.key} className="border-t border-border">
                <th scope="row" className="py-sm pr-sm text-left align-top text-xs font-normal text-text-muted">
                  {row.label}
                  {row.hint && <span className="sr-only">. {row.hint}</span>}
                </th>
                {offers.map((o) => (
                  <td
                    key={o.id}
                    className={cx(
                      'py-sm pr-xs text-right align-top tabular-nums',
                      o.id === selectedOfferId && 'font-semibold',
                    )}
                  >
                    {o.result ? row.cell(o.result) : <span className="text-xs text-text-muted">{placeholder(o)}</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-sm text-xs text-text-muted">{t.compare.totalCostHint}</p>
    </Card>
  );
}
