// The KPI strip of /plan: every value is the rules-based plan's (usePlan → kpis), tagged as such.
import { plan as copy } from '@/copy';
import { Tag, cx } from '@/ui-kit';
import type { PlanKpiVM } from '../model/types';

export function KpiRow({ kpis }: { kpis: readonly PlanKpiVM[] }) {
  const t = copy.screen;
  return (
    <ul aria-label={t.title} className="grid grid-cols-2 gap-md lg:grid-cols-4">
      {kpis.map((k) => (
        <li key={k.id} data-kpi={k.id} className="flex min-w-0 flex-col gap-xs rounded-lg bg-surface p-lg shadow-sm">
          <span className="text-sm text-text-muted" title={k.tooltip}>
            {k.label}
          </span>
          <span
            className={cx(
              'font-display text-2xl font-extrabold leading-tight tabular-nums sm:text-3xl',
              k.tone === 'bad' ? 'text-negative' : 'text-text',
            )}
          >
            {k.value}
          </span>
          <span className="sr-only">{k.tooltip}</span>
          <Tag className="mt-xs w-fit text-xs" title={t.kpiSourceHint}>
            {t.kpiSource}
          </Tag>
        </li>
      ))}
    </ul>
  );
}
