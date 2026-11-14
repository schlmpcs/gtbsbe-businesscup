'use client';

// Plan › Compare (useCompare): two scenarios overlaid, the sentence and the difference table.
import { plan as copy } from '@/copy';
import { Button, Card, Field, cx, useFieldControl } from '@/ui-kit';
import type { CompareVM, ScenariosVM } from '../model/types';
import { LineChart } from './LineChart';
import { SELECT_CLASS } from './PlanField';

export type CompareViewProps = {
  vm: CompareVM;
  scenarios: ScenariosVM;
  /** The scenario compared with the active one. */
  compareWithId: string | null;
  onCompareWith: (id: string) => void;
};

export function CompareView({ vm, scenarios, compareWithId, onCompareWith }: CompareViewProps) {
  const t = copy.screen.compare;
  if (!scenarios.canCompare) {
    return (
      <Card title={copy.compare.title}>
        <div className="flex flex-col items-start gap-md">
          <p className="text-sm text-text-muted">{copy.compare.needTwo}</p>
          <Button onClick={() => scenarios.add()}>{t.addScenario}</Button>
        </div>
      </Card>
    );
  }
  const others = scenarios.items.filter((s) => s.id !== scenarios.activeId);

  return (
    <div className="flex flex-col gap-xl">
      <Card title={copy.compare.title}>
        <div className="flex flex-col gap-lg">
          <p className="text-sm text-text-muted">{t.intro}</p>
          <div className="flex flex-wrap items-end gap-md">
            <Field label={t.withLabel} className="min-w-48 flex-1 sm:flex-none">
              <CompareSelect value={compareWithId ?? others[0]?.id ?? ''} options={others} onChange={onCompareWith} />
            </Field>
            {vm.status === 'ready' && (
              <Button variant="secondary" size="sm" onClick={vm.swap}>
                {t.swap}
              </Button>
            )}
          </div>

          {vm.status !== 'ready' ? (
            <p className="text-sm text-text-muted">{copy.notFound}</p>
          ) : (
            <>
              <p className="font-display text-xl font-bold leading-tight sm:text-2xl" data-testid="compare-sentence">
                {vm.sentence}
              </p>
              <LineChart
                title={copy.compare.title}
                series={[
                  { id: 'a', label: vm.a.name, color: 'var(--color-chart-1)', points: vm.series.map((p) => ({ x: p.year, y: p.a })) },
                  { id: 'b', label: vm.b.name, color: 'var(--color-chart-2)', dashed: true, points: vm.series.map((p) => ({ x: p.year, y: p.b })) },
                ]}
                xTicks={vm.series.filter((p, i) => i === 0 || p.age % 5 === 0).map((p) => ({ x: p.year, label: String(p.age) }))}
                xCaption={copy.screen.chart.axisAge}
                xLabel={(year) => copy.screen.chart.tooltipHeader(year, vm.series.find((p) => p.year === year)?.age ?? 0)}
              />
              <div className="overflow-x-auto">
                <table className="w-full text-sm tabular-nums">
                  <thead className="text-left text-xs text-text-muted">
                    <tr>
                      <th scope="col" className="py-sm pr-sm font-medium"><span className="sr-only">{copy.tables.events.event}</span></th>
                      <th scope="col" className="py-sm pr-sm text-right font-medium">{vm.a.name}</th>
                      <th scope="col" className="py-sm pr-sm text-right font-medium">{vm.b.name}</th>
                      <th scope="col" className="py-sm text-right font-medium">{t.difference}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vm.diffTable.map((r) => (
                      <tr key={r.id} className="border-t border-border" data-diff={r.id}>
                        <th scope="row" className="py-sm pr-sm text-left font-normal text-text-muted">{r.label}</th>
                        <td className="py-sm pr-sm text-right">{r.aLabel}</td>
                        <td className="py-sm pr-sm text-right">{r.bLabel}</td>
                        <td className={cx('py-sm text-right font-semibold', r.tone === 'bad' && 'text-negative', r.tone === 'good' && 'text-positive')}>
                          {r.diffLabel}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

function CompareSelect({ value, options, onChange }: { value: string; options: { id: string; name: string }[]; onChange: (id: string) => void }) {
  const control = useFieldControl();
  return (
    <select {...control} value={value} onChange={(e) => onChange(e.target.value)} className={SELECT_CLASS}>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  );
}
