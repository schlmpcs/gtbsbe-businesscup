'use client';

import { loan as t } from '@/copy';
import { cx, EstimateTag, formatMonth, formatMoney, Money, Tag } from '@/ui-kit';
import type { PayoffColumnVM, PayoffDate, PayoffDelta, PayoffPlannerVM } from '../model/types';

/** "March 2030" from a month and year. */
export function dateText(d: PayoffDate): string {
  return t.planner.monthYear(formatMonth(d.month), d.year);
}

const ROWS = [
  { key: 'debtFree', label: t.planner.compare.rows.debtFree, cell: (c: PayoffColumnVM) => (c.debtFreeDate ? dateText(c.debtFreeDate) : null) },
  { key: 'interest', label: t.planner.compare.rows.interest, cell: (c: PayoffColumnVM) => (c.totalInterest === null ? null : <Money value={c.totalInterest} />) },
  {
    key: 'months',
    label: t.planner.compare.rows.months,
    cell: (c: PayoffColumnVM) => (c.monthsToDebtFree === null ? null : t.planner.months(c.monthsToDebtFree)),
  },
] as const;

function interestText(d: PayoffDelta): string {
  return d.kind === 'same' ? t.planner.savings.interestSame : (d.kind === 'saves' ? t.planner.savings.interestSaves : t.planner.savings.interestCosts)(formatMoney(d.amount));
}

function monthsText(d: PayoffDelta): string {
  if (d.kind === 'same') return t.planner.savings.monthsSame;
  return (d.kind === 'saves' ? t.planner.savings.monthsSaves : t.planner.savings.monthsCosts)(d.amount);
}

/**
 * Avalanche, snowball and minimums only side by side, what the picked one does against minimums, and, when methods
 * come out the same, one line saying why (identical columns with no reason look like a broken comparison).
 */
export function PayoffCompare({ vm }: { vm: PayoffPlannerVM }) {
  const minimum = vm.columns.find((c) => c.method === 'minimum');
  const picked = vm.columns.find((c) => c.isSelected);
  // When all three plans are the same, "about the same interest · the same debt-free month" says nothing the reason
  // does not, so the reason takes its place; when only avalanche and snowball match, both lines are shown.
  const allSame = vm.tie === 'noExtra' || vm.tie === 'tooSmall';
  return (
    <div className="flex flex-col gap-md">
      <div className="flex flex-wrap items-center gap-sm">
        <h3 className="text-lg font-bold">{t.planner.compare.title}</h3>
        {vm.isEstimate && <EstimateTag />}
      </div>
      <div>
        <table className="w-full table-fixed border-collapse text-left">
          <caption className="sr-only">{t.planner.compare.caption}</caption>
          <thead>
            <tr>
              <th scope="col" className="w-[22%] pb-sm">
                <span className="sr-only">{t.planner.compare.metric}</span>
              </th>
              {vm.columns.map((c) => (
                <th key={c.method} scope="col" className={cx('min-w-0 px-xs pt-sm pb-sm align-top sm:px-sm', c.isSelected && 'rounded-t-lg bg-primary-soft')}>
                  <span className="flex flex-col items-start gap-xs">
                    <span className={cx('text-sm sm:text-base', c.isSelected ? 'font-extrabold' : 'font-semibold')}>{t.planner.method.names[c.method]}</span>
                    {c.isSelected && (
                      <Tag className="border-ink text-text">{t.planner.compare.picked}</Tag>
                    )}
                    <span className="hidden text-xs font-normal text-text-muted sm:block">{t.planner.method.describes[c.method]}</span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.key} className="border-t border-border">
                <th scope="row" className="py-sm pr-xs text-xs font-medium text-text-muted sm:text-sm">
                  {row.label}
                </th>
                {vm.columns.map((c) => (
                  <td key={c.method} className={cx('px-xs py-sm text-sm tabular-nums break-words sm:px-sm sm:text-base', c.isSelected ? 'bg-primary-soft font-bold' : 'font-semibold')}>
                    {row.cell(c) ?? <span className="text-sm font-medium text-text-muted">{t.planner.compare.never}</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {allSame ? null : vm.savings ? (
        <p data-testid="payoff-savings" className="text-lg font-semibold">
          <span className="text-text-muted">{t.planner.savings.title(t.planner.method.names[vm.method])}</span>{' '}
          <span className={vm.savings.interest.kind === 'saves' ? 'text-positive' : undefined}>{interestText(vm.savings.interest)}</span>
          {vm.savings.months && (
            <>
              <span aria-hidden="true"> · </span>
              <span className={vm.savings.months.kind === 'saves' ? 'text-positive' : undefined}>{monthsText(vm.savings.months)}</span>
            </>
          )}
        </p>
      ) : (
        picked?.monthsToDebtFree !== null && minimum?.monthsToDebtFree === null && <p className="text-sm text-text-muted">{t.planner.savings.minimumNever}</p>
      )}
      {vm.tie && (
        <p data-testid="payoff-tie" className={allSame ? 'text-base font-semibold' : 'text-sm text-text-muted'}>
          {t.planner.tie[vm.tie]}
        </p>
      )}
    </div>
  );
}
