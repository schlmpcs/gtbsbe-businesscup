// "How we calculate" (S10): every engine assumption behind the forecast and the moves, with its
// source or an "our assumption" tag. Values arrive from the view-model; here they are only formatted.
import { forecast as t } from '@/copy';
import { formatMoney, formatRate, SourceNote } from '@/ui-kit';
import type { AssumptionValue, AssumptionVM, HowWeCalculateVM } from '../model/types';
import { AssumptionTag } from './shared';

function valueText(v: AssumptionValue): string {
  const f = t.how.values;
  switch (v.kind) {
    case 'ratePerYear':
      return f.ratePerYear(formatRate(v.value, 2));
    case 'share':
      return f.share(formatRate(v.value));
    case 'spread':
      return f.spread(formatRate(v.value));
    case 'money':
      return f.money(formatMoney(v.value));
    case 'sameAsInflation':
      return f.sameAsInflation;
    case 'cardMinPayment':
      return f.cardMinPayment(formatRate(v.balanceShare), formatMoney(v.floor));
  }
}

function Group({ title, items }: { title: string; items: AssumptionVM[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">{title}</h3>
      <dl className="mt-sm divide-y divide-border">
        {items.map((a) => (
          <div key={a.id} className="flex flex-col gap-xs py-sm" data-assumption={a.id}>
            <dt className="text-sm">{t.how.labels[a.id]}</dt>
            <dd className="flex flex-col items-start gap-xs">
              <span className="flex flex-wrap items-center gap-sm">
                <span className="font-semibold tabular-nums">{valueText(a.value)}</span>
                {a.isAssumption && <AssumptionTag />}
              </span>
              {a.source && <SourceNote source={a.source} />}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function HowWeCalculate({ vm }: { vm: HowWeCalculateVM }) {
  return (
    <details className="group rounded-lg border border-border bg-bg p-lg shadow-sm" data-testid="how-we-calculate">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-md text-lg font-semibold">
        <h2>{t.how.title}</h2>
        <span aria-hidden="true" className="text-text-muted transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <p className="mt-sm text-sm text-text-muted">{t.how.intro}</p>
      <div className="mt-md flex flex-col gap-lg">
        <Group title={t.how.forecastTitle} items={vm.forecast} />
        <Group title={t.how.movesTitle} items={vm.moves} />
      </div>
    </details>
  );
}
