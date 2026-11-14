'use client';

// The Assumptions panel (useAssumptions): retirement and end ages, inflation, display unit, spending,
// growth per account group, the withdrawal order and the savings split. Changes go straight to the hook,
// which validates them; refusals come back as `errorMessage`.
import { plan as copy } from '@/copy';
import { Button, Card, Field, NumberInput, SourceNote } from '@/ui-kit';
import type { AccountGroup, AssumptionKey, AssumptionsVM } from '../model/types';
import { PlanField } from './PlanField';

export function AssumptionsPanel({ vm }: { vm: AssumptionsVM }) {
  const t = copy.screen.assumptions;
  const order = vm.withdrawalOrder.map((w) => w.group);
  const moveTo = (i: number, j: number) => {
    if (j < 0 || j >= order.length) return;
    const next: AccountGroup[] = [...order];
    [next[i], next[j]] = [next[j]!, next[i]!];
    vm.setWithdrawalOrder(next);
  };

  return (
    <Card title={t.title}>
      <div className="flex flex-col gap-xl">
        <div className="grid gap-md sm:grid-cols-2 lg:grid-cols-1">
          {vm.fields.map((f) => (
            <PlanField key={f.key} field={f} onChange={(key, value) => vm.update(key as AssumptionKey, value)} />
          ))}
        </div>

        <section aria-labelledby="plan-growth" className="flex flex-col gap-md">
          <h3 id="plan-growth" className="text-base font-semibold">{t.growthTitle}</h3>
          <div className="grid gap-md sm:grid-cols-2 lg:grid-cols-1">
            {vm.growth.map((g) => (
              <div key={g.group} className="flex flex-col gap-xs">
                <Field label={g.label} hint={g.hint}>
                  <NumberInput value={g.rate} onValueChange={(v) => vm.updateGrowth(g.group, v)} percent min={-1} max={1} maxFractionDigits={2} suffix="%" />
                </Field>
                {g.override !== null && (
                  <Button variant="ghost" size="sm" className="self-start" onClick={() => vm.updateGrowth(g.group, null)}>
                    {t.growthReset}
                  </Button>
                )}
                {g.source && <SourceNote source={g.source} />}
              </div>
            ))}
          </div>
        </section>

        {vm.withdrawalOrder.length > 0 && (
          <section aria-labelledby="plan-withdrawal" className="flex flex-col gap-sm">
            <h3 id="plan-withdrawal" className="text-base font-semibold">{t.withdrawalTitle}</h3>
            <ol className="flex flex-col gap-xs">
              {vm.withdrawalOrder.map((w, i) => (
                <li key={w.group} className="flex items-center justify-between gap-sm rounded-md bg-surface-strong px-md py-xs text-sm">
                  <span>
                    <span className="mr-sm tabular-nums text-text-muted">{i + 1}.</span>
                    {w.label}
                  </span>
                  <span className="flex gap-xs">
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
          </section>
        )}

        {vm.savingsSplit.length > 0 && (
          <section aria-labelledby="plan-split" className="flex flex-col gap-sm">
            <h3 id="plan-split" className="text-base font-semibold">{t.splitTitle}</h3>
            <dl className="flex flex-col gap-xs text-sm">
              {vm.savingsSplit.map((s) => (
                <div key={s.group} className="flex justify-between gap-md">
                  <dt className="text-text-muted">{s.label}</dt>
                  <dd className="tabular-nums">{s.shareLabel}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {vm.errorMessage && (
          <p role="alert" className="text-sm font-medium text-negative">
            {vm.errorMessage}
          </p>
        )}
      </div>
    </Card>
  );
}
