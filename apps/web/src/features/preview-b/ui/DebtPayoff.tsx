'use client';

// S24 Debt payoff (design preview): editable debts, three plans side by side, and a target-date solve.
import { useState } from 'react';
import { previewB as c } from '@/copy';
import { Button, Card, EstimateTag, Field, NumberInput, Stack, cx, formatMoney, formatRate } from '@/ui-kit';
import type { PayoffDebtVM, PayoffPlanVM, PayoffVM } from '../model/types';
import { Pill, RowList, Segmented, ToolShell } from './shared';

const t = c.payoff;

export function DebtPayoff({ vm }: { vm: PayoffVM }) {
  const [picked, setPicked] = useState<PayoffPlanVM['method']>('avalanche');
  const [extra, setExtra] = useState<number | null>(vm.extra);
  const [target, setTarget] = useState(vm.target.initial);
  const solved = vm.target.options.find((o) => o.label === target) ?? vm.target.options[0]!;
  const kindOf = Object.fromEntries(vm.debts.map((d) => [d.id, t.kinds[d.kind]]));
  return (
    <ToolShell id="S24" title={t.title} intro={t.intro} note={c.engineNote}>
      <Card title={t.debtsHeading}>
        <RowList label={t.debtsHeading}>
          {vm.debts.map((d) => (
            <DebtRow key={d.id} debt={d} />
          ))}
        </RowList>
        <Button variant="ghost" size="sm" className="mt-sm">
          {t.addDebt}
        </Button>
      </Card>

      <Card>
        <Num label={t.extraLabel} value={extra} onValueChange={setExtra} prefix="$" min={0} />
      </Card>

      <section aria-labelledby="payoff-compare" className="flex flex-col gap-md">
        <h2 id="payoff-compare" className="text-xl font-bold">
          {t.compareHeading}
        </h2>
        <div className="grid grid-cols-1 gap-md md:grid-cols-3">
          {vm.plans.map((p) => (
            <PlanCard key={p.method} plan={p} picked={picked === p.method} onPick={() => setPicked(p.method)} kindOf={kindOf} />
          ))}
        </div>
      </section>

      <Card title={t.targetHeading}>
        <Stack gap="md">
          <div className="flex flex-col gap-xs">
            <span className="text-sm text-text-muted">{t.targetLabel}</span>
            <Segmented label={t.targetLabel} value={target} onChange={setTarget} options={vm.target.options.map((o) => ({ value: o.label, label: o.label }))} />
          </div>
          <p className="font-display text-2xl font-extrabold leading-tight">{solved.reachable ? t.targetResult(formatMoney(solved.extra), solved.label) : t.targetUnreachable(solved.label)}</p>
          <Button fullWidth>{t.addMove}</Button>
        </Stack>
      </Card>
      <p className="text-xs text-text-muted">{t.note}</p>
    </ToolShell>
  );
}

function DebtRow({ debt }: { debt: PayoffDebtVM }) {
  const [editing, setEditing] = useState(false);
  const [balance, setBalance] = useState<number | null>(debt.balance);
  const [apr, setApr] = useState<number | null>(debt.apr);
  const [min, setMin] = useState<number | null>(debt.minPayment);
  return (
    <li className="flex flex-col gap-sm py-md">
      <div className="flex items-center justify-between gap-md">
        <p className="font-semibold">{t.kinds[debt.kind]}</p>
        <div className="flex gap-xs">
          {editing && (
            <Button variant="ghost" size="sm">
              {t.remove}
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => setEditing((e) => !e)}>
            {editing ? t.done : t.edit}
          </Button>
        </div>
      </div>
      {editing ? (
        <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
          <Num label={t.balance} value={balance} onValueChange={setBalance} prefix="$" min={0} />
          <Num label={t.apr} value={apr} onValueChange={setApr} percent min={0} />
          <Num label={t.min} value={min} onValueChange={setMin} prefix="$" min={0} />
        </div>
      ) : (
        <dl className="grid grid-cols-3 gap-sm text-sm">
          <div>
            <dt className="text-xs text-text-muted">{t.balance}</dt>
            <dd className="font-semibold tabular-nums">{formatMoney(debt.balance)}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">{t.apr}</dt>
            <dd className="font-semibold tabular-nums">{formatRate(debt.apr)}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">{t.min}</dt>
            <dd className="flex flex-wrap items-center gap-xs font-semibold tabular-nums">
              {formatMoney(debt.minPayment)}
              {debt.isEstimate && <EstimateTag />}
            </dd>
          </div>
        </dl>
      )}
    </li>
  );
}

function PlanCard({ plan, picked, onPick, kindOf }: { plan: PayoffPlanVM; picked: boolean; onPick: () => void; kindOf: Record<string, string> }) {
  const m = t.methods[plan.method];
  const isMin = plan.method === 'minimum';
  return (
    <div className={cx('flex flex-col gap-md rounded-xl p-xl', picked ? 'bg-surface shadow-lg ring-2 ring-primary' : isMin ? 'bg-surface-strong' : 'bg-surface shadow-md')}>
      <div>
        <p className="font-display text-2xl font-extrabold">{m.name}</p>
        <p className="text-sm text-text-muted">{m.hint}</p>
      </div>
      <dl className="flex flex-col gap-sm">
        <div>
          <dt className="text-xs text-text-muted">{t.debtFree}</dt>
          <dd className="font-display text-3xl font-extrabold leading-tight">{plan.debtFreeLabel}</dd>
          {!isMin && plan.monthsSooner !== null && plan.monthsSooner > 0 && <Pill tone="positive">{t.sooner(plan.monthsSooner)}</Pill>}
        </div>
        <div>
          <dt className="text-xs text-text-muted">{t.interest}</dt>
          <dd className="font-semibold tabular-nums">{formatMoney(plan.totalInterest)}</dd>
        </div>
        {!isMin && (
          <div>
            <dt className="text-xs text-text-muted">{t.saved}</dt>
            <dd className="font-semibold tabular-nums text-positive">{formatMoney(plan.interestSaved)}</dd>
          </div>
        )}
        <div>
          <dt className="text-xs text-text-muted">{t.order}</dt>
          <dd className="text-sm">{plan.order.map((id) => kindOf[id] ?? id).join(' → ')}</dd>
        </div>
      </dl>
      {!isMin && (
        <Button variant={picked ? 'primary' : 'secondary'} size="sm" fullWidth aria-pressed={picked} onClick={onPick} className="mt-auto">
          {picked ? t.picked : t.pick}
        </Button>
      )}
    </div>
  );
}

function Num({ label, ...rest }: { label: string } & Parameters<typeof NumberInput>[0]) {
  return (
    <Field label={label}>
      <NumberInput {...rest} />
    </Field>
  );
}
