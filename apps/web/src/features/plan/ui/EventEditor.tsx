'use client';

// The event panel (useEventEditor): every field with its source and estimate tag, the monthly cost of a
// home, and the with / without preview. Opens as a sheet from the event list, a chart marker or "Add event".
import { plan as copy } from '@/copy';
import { Button, Field, Sheet, cx, useFieldControl } from '@/ui-kit';
import type { EventEditorVM, PlanFieldValue } from '../model/types';
import { EventIcon } from './EventIcon';
import { LineChart } from './LineChart';
import { PlanField } from './PlanField';

export type EventEditorProps = {
  open: boolean;
  editor: EventEditorVM;
  onClose: () => void;
};

export function EventEditor({ open, editor, onClose }: EventEditorProps) {
  const t = copy.screen.editor;
  if (editor.status !== 'ready') {
    return (
      <Sheet open={open} onClose={onClose} title={copy.editor.notFound}>
        <p className="text-sm text-text-muted">{editor.message}</p>
      </Sheet>
    );
  }
  const vm = editor;
  const update = (key: string, value: PlanFieldValue) => vm.update(key, value);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={
        <span className="flex items-center gap-sm">
          <EventIcon id={vm.icon} />
          {vm.name || vm.title}
        </span>
      }
      description={copy.events[vm.type].description}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-sm">
          <Button variant="ghost" size="sm" onClick={vm.remove} className="text-negative">
            {t.remove}
          </Button>
          <Button onClick={onClose}>{t.done}</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-lg">
        <label className="flex min-h-11 items-center justify-between gap-md text-sm font-medium">
          <span>{t.enabled}</span>
          <input type="checkbox" checked={vm.enabled} onChange={vm.toggleEnabled} className="size-lg accent-(--color-primary)" />
        </label>

        <Field label={t.name}>
          <NameInput value={vm.name} placeholder={vm.title} onChange={(v) => update('name', v)} />
        </Field>

        <div className="grid gap-md sm:grid-cols-2">
          {vm.fields.map((f) => (
            <PlanField
              key={f.key}
              field={f}
              onChange={update}
              className={f.kind === 'toggle' ? 'sm:col-span-2' : undefined}
            />
          ))}
        </div>
        {vm.fields.some((f) => f.isEstimate) && <p className="text-xs text-text-muted">{copy.editor.estimateNote}</p>}

        {vm.breakdown && (
          <section aria-labelledby="plan-breakdown" className="flex flex-col gap-sm rounded-md bg-surface-strong p-md">
            <h3 id="plan-breakdown" className="text-sm font-semibold">{t.breakdownTitle}</h3>
            <dl className="flex flex-col gap-xs text-sm">
              {vm.breakdown.lines.map((l) => (
                <div key={l.key} className="flex justify-between gap-md">
                  <dt className="text-text-muted">{l.label}</dt>
                  <dd className="tabular-nums">{l.amountLabel}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-md border-t border-border pt-xs font-semibold">
                <dt>{copy.editor.breakdown.total}</dt>
                <dd className="tabular-nums">{vm.breakdown.totalLabel}</dd>
              </div>
            </dl>
          </section>
        )}

        <section aria-labelledby="plan-preview" className="flex flex-col gap-sm">
          <h3 id="plan-preview" className="text-sm font-semibold">{t.previewTitle}</h3>
          <LineChart
            title={t.previewTitle}
            heightClass="h-36"
            series={[
              { id: 'with', label: copy.editor.preview.with, color: 'var(--color-chart-1)', points: vm.preview.series.map((p) => ({ x: p.year, y: p.withEvent })) },
              { id: 'without', label: copy.editor.preview.without, color: 'var(--color-chart-6)', dashed: true, points: vm.preview.series.map((p) => ({ x: p.year, y: p.withoutEvent })) },
            ]}
            xTicks={vm.preview.series.filter((p) => p.age % 10 === 0).map((p) => ({ x: p.year, label: String(p.age) }))}
            xCaption={copy.screen.chart.axisAge}
            xLabel={(year) => copy.screen.chart.tooltipHeader(year, vm.preview.series.find((p) => p.year === year)?.age ?? 0)}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead className="text-left text-xs text-text-muted">
                <tr>
                  <th scope="col" className="py-xs pr-sm font-medium"><span className="sr-only">{copy.tables.events.event}</span></th>
                  <th scope="col" className="py-xs pr-sm text-right font-medium">{copy.editor.preview.with}</th>
                  <th scope="col" className="py-xs pr-sm text-right font-medium">{copy.editor.preview.without}</th>
                  <th scope="col" className="py-xs text-right font-medium">{copy.screen.compare.difference}</th>
                </tr>
              </thead>
              <tbody>
                {vm.preview.rows.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <th scope="row" className="py-xs pr-sm text-left font-normal text-text-muted">{r.label}</th>
                    <td className="py-xs pr-sm text-right">{r.withLabel}</td>
                    <td className="py-xs pr-sm text-right">{r.withoutLabel}</td>
                    <td className={cx('py-xs text-right font-semibold', r.tone === 'bad' ? 'text-negative' : 'text-positive')}>{r.deltaLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </Sheet>
  );
}

function NameInput({ value, placeholder, onChange }: { value: string; placeholder: string; onChange: (v: string) => void }) {
  const control = useFieldControl();
  return (
    <input
      {...control}
      type="text"
      value={value}
      placeholder={placeholder}
      maxLength={60}
      autoComplete="off"
      onChange={(e) => onChange(e.target.value)}
      className="min-h-11 w-full rounded-md border border-border bg-bg px-md text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    />
  );
}
