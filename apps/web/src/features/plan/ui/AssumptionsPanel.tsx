'use client';

// The Assumptions panel (useAssumptions), in collapsible sections: timeline (retirement and end ages),
// inflation (slider + number), spending, growth per account group, the withdrawal order and the savings
// split. It sits in the right-hand panel on wide screens and in a sheet on smaller ones; the display unit
// lives on the chart. Changes go straight to the hook, which validates them; refusals come back as
// `errorMessage`.
import type { ReactNode } from 'react';
import { plan as copy } from '@/copy';
import { Button, Field, NumberInput, Slider, SourceNote, Tag, formatRate } from '@/ui-kit';
import type { AccountGroup, AssumptionFieldVM, AssumptionKey, AssumptionsVM } from '../model/types';
import { PlanField } from './PlanField';

/** A collapsible panel section (native details/summary: keyboard and screen reader friendly). */
export function PanelSection({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group border-t border-border first:border-t-0">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-sm py-sm text-sm font-bold [&::-webkit-details-marker]:hidden">
        {title}
        <svg aria-hidden="true" viewBox="0 0 16 16" className="size-md shrink-0 text-text-muted transition-transform group-open:rotate-180 motion-reduce:transition-none">
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="flex flex-col gap-md pb-lg">{children}</div>
    </details>
  );
}

export function AssumptionsPanel({ vm }: { vm: AssumptionsVM }) {
  const t = copy.screen.assumptions;
  const field = (key: AssumptionKey) => vm.fields.find((f) => f.key === key);
  const onChange = (key: string, value: AssumptionFieldVM['value']) => vm.update(key as AssumptionKey, value);
  const order = vm.withdrawalOrder.map((w) => w.group);
  const moveTo = (i: number, j: number) => {
    if (j < 0 || j >= order.length) return;
    const next: AccountGroup[] = [...order];
    [next[i], next[j]] = [next[j]!, next[i]!];
    vm.setWithdrawalOrder(next);
  };
  const retire = field('retireAge');
  const end = field('endAge');
  const inflation = field('inflation');
  const mode = field('expensesMode');
  const monthly = field('expensesMonthly');

  return (
    <div className="flex flex-col">
      <p className="pb-md text-xs text-text-muted">{t.intro}</p>

      <PanelSection title={t.timelineTitle}>
        {retire && <PlanField field={retire} onChange={onChange} />}
        {end && <PlanField field={end} onChange={onChange} />}
      </PanelSection>

      {inflation && (
        <PanelSection title={t.inflationTitle}>
          <InflationControl field={inflation} onChange={(v) => vm.update('inflation', v)} />
        </PanelSection>
      )}

      {(mode || monthly) && (
        <PanelSection title={t.spendingTitle}>
          {mode && <PlanField field={mode} onChange={onChange} />}
          {monthly && <PlanField field={monthly} onChange={onChange} />}
        </PanelSection>
      )}

      <PanelSection title={t.growthTitle}>
        <GrowthAiControls vm={vm} />
        {vm.growth.map((g) => (
          <div key={g.group} className="flex flex-col gap-xs">
            <Field label={g.label} hint={g.hint}>
              <NumberInput value={g.rate} onValueChange={(v) => vm.updateGrowth(g.group, v)} percent min={-1} max={1} maxFractionDigits={2} suffix="%" />
            </Field>
            {g.aiNote && (
              <p className="flex flex-wrap items-center gap-xs text-xs text-text-muted">
                <Tag>{t.growthAiLabel}</Tag>
                <span>{g.aiNote.reason}</span>
              </p>
            )}
            {g.override !== null && (
              <Button variant="ghost" size="sm" className="self-start" onClick={() => vm.updateGrowth(g.group, null)}>
                {t.growthReset}
              </Button>
            )}
            {g.source && <SourceNote source={g.source} />}
            {g.suggestion && !g.suggestion.applied && (
              <div className="flex flex-col gap-xs rounded-md border border-dashed border-border p-sm text-sm">
                <span className="flex flex-wrap items-center gap-xs">
                  <Tag>{t.growthAiLabel}</Tag>
                  <span className="font-semibold tabular-nums">{t.growthAiSuggestion(g.suggestion.rateLabel)}</span>
                </span>
                <span className="text-xs text-text-muted">{g.suggestion.reason}</span>
                <Button variant="secondary" size="sm" className="self-start" aria-label={t.growthAiApplyFor(g.label)} onClick={() => vm.applyGrowthSuggestion(g.group)}>
                  {t.growthAiApply}
                </Button>
              </div>
            )}
          </div>
        ))}
      </PanelSection>

      {vm.withdrawalOrder.length > 0 && (
        <PanelSection title={t.withdrawalTitle} defaultOpen={false}>
          <p className="text-xs text-text-muted">{t.withdrawalHint}</p>
          <ol className="flex flex-col gap-xs">
            {vm.withdrawalOrder.map((w, i) => (
              <li key={w.group} className="flex items-center justify-between gap-sm rounded-md bg-surface-strong pl-md text-sm">
                <span>
                  <span className="mr-sm tabular-nums text-text-muted">{i + 1}.</span>
                  {w.label}
                </span>
                <span className="flex">
                  <button
                    type="button"
                    aria-label={t.moveUp(w.label)}
                    disabled={i === 0}
                    onClick={() => moveTo(i, i - 1)}
                    className="min-h-11 min-w-11 rounded-sm text-text-muted hover:text-text disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={t.moveDown(w.label)}
                    disabled={i === vm.withdrawalOrder.length - 1}
                    onClick={() => moveTo(i, i + 1)}
                    className="min-h-11 min-w-11 rounded-sm text-text-muted hover:text-text disabled:opacity-30"
                  >
                    ↓
                  </button>
                </span>
              </li>
            ))}
          </ol>
        </PanelSection>
      )}

      {vm.savingsSplit.length > 0 && (
        <PanelSection title={t.splitTitle} defaultOpen={false}>
          <ul className="flex flex-col gap-sm text-sm">
            {vm.savingsSplit.map((s) => (
              <li key={s.group} className="flex flex-col gap-xs">
                <span className="flex justify-between gap-md">
                  <span className="text-text-muted">{s.label}</span>
                  <span className="font-semibold tabular-nums">{s.shareLabel}</span>
                </span>
                <span aria-hidden="true" className="h-sm overflow-hidden rounded-full bg-surface-strong">
                  <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, s.share * 100))}%` }} />
                </span>
              </li>
            ))}
          </ul>
        </PanelSection>
      )}

      {vm.errorMessage && (
        <p role="alert" className="text-sm font-medium text-negative">
          {vm.errorMessage}
        </p>
      )}
    </div>
  );
}

/**
 * "Estimate with AI" for the growth defaults: the button, what is sent, the scope line, "Apply all" and
 * any message. Each row then shows its suggestion next to the default (above).
 */
function GrowthAiControls({ vm }: { vm: AssumptionsVM }) {
  const t = copy.screen.assumptions;
  const ai = vm.growthAi;
  const loading = ai.status === 'loading';
  return (
    <div className="flex flex-col gap-xs">
      <div className="flex flex-wrap gap-sm">
        <Button variant="secondary" size="sm" onClick={ai.ask} disabled={loading} aria-busy={loading}>
          {loading ? t.growthAiLoading : t.growthAiButton}
        </Button>
        {ai.canApplyAll && (
          <Button variant="ghost" size="sm" onClick={ai.applyAll}>
            {t.growthAiApplyAll}
          </Button>
        )}
      </div>
      <p className="text-xs text-text-muted">{t.growthAiPrivacy}</p>
      {ai.status === 'ready' && <p className="text-xs text-text-muted">{t.growthAiScope}</p>}
      {ai.message && (
        <p role="status" className="text-xs font-medium text-text-muted">
          {ai.message}
        </p>
      )}
    </div>
  );
}

/** Inflation as a slider (0–10%) and an exact number; both write the same assumption. */
function InflationControl({ field, onChange }: { field: AssumptionFieldVM; onChange: (v: number) => void }) {
  const t = copy.screen.assumptions;
  const value = typeof field.value === 'number' ? field.value : 0;
  return (
    <div className="flex flex-col gap-md">
      <Slider
        label={t.inflationSlider}
        value={Math.min(0.1, value)}
        min={0}
        max={0.1}
        step={0.0025}
        formatValue={(v) => formatRate(v, 2)}
        isEstimate={field.isEstimate}
        onValueChange={onChange}
      />
      <Field label={field.label} hint={field.hint}>
        <NumberInput
          value={value}
          percent
          min={field.min ?? 0}
          max={field.max ?? 0.2}
          maxFractionDigits={3}
          suffix="%"
          onValueChange={(v) => {
            if (v !== null) onChange(v);
          }}
        />
      </Field>
      {field.source && <SourceNote source={field.source} />}
    </div>
  );
}
