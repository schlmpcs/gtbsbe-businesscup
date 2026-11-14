'use client';
import type { ReactNode } from 'react';
import { start as t } from '@/copy';
import { ChipGroup } from '@/ui-kit/arc';
import { Button, formatMoney, Photo } from '@/ui-kit';
import type { GenerateVM } from '../model/types';
import { BackIcon, SparkIcon } from './icons';

export type GenerateFormProps = { vm: GenerateVM; onBack: () => void };

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-sm">
      <span className="text-xs font-bold uppercase tracking-wide text-text-muted">{label}</span>
      {children}
    </div>
  );
}

/** Single choice on top of Arc's chip group: a tap on the chosen chip keeps it chosen. */
function One<T extends string>({ label, options, value, onChange, names }: {
  label: string; options: readonly T[]; value: T; onChange: (v: T) => void; names: (v: T) => string;
}) {
  return (
    <ChipGroup
      label={label}
      multiple={false}
      options={options.map((o) => ({ value: o, label: names(o) }))}
      value={[value]}
      onValueChange={(next) => { if (next[0]) onChange(next[0] as T); }}
    />
  );
}

function PreviewRow({ label, amount, source }: { label: string; amount: number; source?: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-md border-b border-border py-sm last:border-b-0">
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-semibold">{label}</span>
        {source ? <span className="truncate text-xs text-text-muted" title={source}>{source}</span> : null}
      </span>
      <span className="shrink-0 font-display text-lg font-bold tabular-nums">{formatMoney(amount)}</span>
    </div>
  );
}

/** Step 2a: five taps describe a life; the preview shows the public figures it will be built from. */
export function GenerateForm({ vm, onBack }: GenerateFormProps) {
  const p = vm.preview;
  const shortMetro = (m: string) => m.replace(/-St\. Paul|-Fort Worth/, '').replace(/, [A-Z]{2}$/, '');
  return (
    <div className="grid grid-cols-1 gap-xl [&>*]:min-w-0 lg:grid-cols-[1.2fr_1fr] lg:gap-3xl">
      <div className="flex flex-col gap-xl">
        <div className="flex flex-col gap-sm">
          <button type="button" onClick={onBack} className="inline-flex w-fit items-center gap-xs text-sm font-semibold text-text-muted hover:text-text">
            <BackIcon />{t.generate.back}
          </button>
          <h1 className="text-3xl leading-tight">{t.generate.title}</h1>
          <p className="text-text-muted">{t.generate.lead}</p>
        </div>

        <Field label={t.generate.city}>
          <One label={t.generate.city} options={vm.metros} value={vm.metro} onChange={vm.setMetro} names={shortMetro} />
        </Field>
        <Field label={t.generate.neighborhood}>
          <One label={t.generate.neighborhood} options={vm.tiers} value={vm.tier} onChange={vm.setTier} names={(x) => t.generate.tiers[x]} />
        </Field>
        <Field label={t.generate.household}>
          <One label={t.generate.household} options={vm.households} value={vm.household} onChange={vm.setHousehold} names={(x) => t.generate.households[x]} />
        </Field>
        <Field label={t.generate.pay}>
          <One
            label={t.generate.pay}
            options={vm.pays}
            value={vm.pay}
            onChange={vm.setPay}
            names={(x) => `${t.generate.pays[x]} · ${formatMoney(vm.payAmounts[x])}${t.generate.perMonth}`}
          />
        </Field>
        <Field label={t.generate.style}>
          <One label={t.generate.style} options={vm.styles} value={vm.style} onChange={vm.setStyle} names={(x) => t.generate.styles[x]} />
        </Field>
      </div>

      <aside className="flex flex-col gap-md lg:sticky lg:top-xl lg:self-start">
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <div className="aspect-[3/1.4] w-full bg-surface-strong">
            <Photo src="/onboarding/statement.webp" alt="" />
          </div>
          <div className="flex flex-col gap-xs p-lg">
            <span className="text-xs font-bold uppercase tracking-wide text-text-muted">{t.generate.previewTitle}</span>
            <span className="text-sm text-text-muted">{vm.metro} · ZIP {p.zip}</span>
            <div className="mt-sm">
              <PreviewRow label={t.generate.previewRent(p.bedrooms)} amount={p.rentUtilities} source={p.sources.rent} />
              {p.childcare != null ? <PreviewRow label={t.generate.previewChildcare} amount={p.childcare} source={p.sources.childcare} /> : null}
              <PreviewRow label={t.generate.previewGroceries} amount={p.groceries} source={p.sources.groceries} />
              {p.car != null ? <PreviewRow label={t.generate.previewCar} amount={p.car} source={p.sources.car} /> : null}
              {p.transit != null ? <PreviewRow label={t.generate.previewTransit} amount={p.transit} /> : null}
              <PreviewRow label={t.generate.previewPay} amount={p.takeHome} />
            </div>
            <p className="mt-sm text-xs text-text-muted">{t.generate.previewNote}</p>
          </div>
        </div>
        <div className="sticky bottom-md z-10 lg:static">
          <Button size="lg" fullWidth onClick={vm.generate} data-testid="generate-statement" className="shadow-[0_10px_30px_rgb(255_91_46/0.35)]">
            <SparkIcon />{t.generate.cta}
          </Button>
        </div>
      </aside>
    </div>
  );
}
