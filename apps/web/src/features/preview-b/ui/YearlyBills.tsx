'use client';

// S26 Yearly bills (design preview): once-a-year bills → a monthly set-aside, and a 12-month strip.
import { useState } from 'react';
import { previewB as c } from '@/copy';
import { Button, Card, EstimateTag, Stack, cx, formatMoney } from '@/ui-kit';
import type { MonthCellVM, YearlyVM } from '../model/types';
import { RowList, Segmented, ToolShell } from './shared';

const t = c.yearly;
type Mode = 'without' | 'with';

export function YearlyBills({ vm }: { vm: YearlyVM }) {
  const [bills, setBills] = useState(vm.bills);
  const [mode, setMode] = useState<Mode>('without');
  const cells = mode === 'without' ? vm.without : vm.withSetAside;
  return (
    <ToolShell id="S26" title={t.title} intro={t.intro}>
      <Card title={t.listHeading}>
        <RowList label={t.listHeading}>
          {bills.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-md py-md">
              <div className="min-w-0">
                <p className="font-semibold">{b.name}</p>
                <p className="flex flex-wrap items-center gap-xs text-sm text-text-muted">
                  {t.due(b.dueMonth)}
                  {b.isEstimate && <EstimateTag />}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-sm">
                <span className="font-semibold tabular-nums">{formatMoney(b.amount)}</span>
                <Button variant="ghost" size="sm" aria-label={`${t.remove} ${b.name}`} onClick={() => setBills((all) => all.filter((x) => x.id !== b.id))}>
                  ✕
                </Button>
              </div>
            </li>
          ))}
        </RowList>
        <Button variant="ghost" size="sm" className="mt-sm">
          {t.addBill}
        </Button>
      </Card>

      <Card tone="arena">
        <p className="text-sm">{t.setAside}</p>
        <p className="font-display text-display leading-display font-extrabold tabular-nums">
          {formatMoney(vm.setAside)}
          <span className="text-2xl">{c.perMonth}</span>
        </p>
        <p className="mt-xs text-sm">{t.setAsideHint}</p>
      </Card>

      <Card title={t.stripHeading}>
        <Stack gap="md">
          <Segmented
            label={t.stripHeading}
            value={mode}
            onChange={setMode}
            options={[
              { value: 'without', label: t.toggleWithout },
              { value: 'with', label: t.toggleWith },
            ]}
          />
          <ol className="grid grid-cols-4 gap-xs sm:grid-cols-6">
            {cells.map((cell) => (
              <MonthCell key={cell.month} cell={cell} first={mode === 'without' && vm.firstShort?.month === cell.month} />
            ))}
          </ol>
          <div className="flex flex-wrap gap-md text-xs text-text-muted">
            <span className="flex items-center gap-xs">
              <span aria-hidden="true" className="size-sm rounded-full bg-positive-soft ring-1 ring-positive" />
              {t.stripLegendOk}
            </span>
            <span className="flex items-center gap-xs">
              <span aria-hidden="true" className="size-sm rounded-full bg-surface-strong ring-1 ring-text" />
              {t.stripLegendShort}
            </span>
          </div>
          <p className="font-semibold">
            {mode === 'without' && vm.firstShort ? t.firstShort(vm.firstShort.month, formatMoney(vm.firstShort.amount)) : t.withSetAside}
          </p>
        </Stack>
      </Card>

      <div className="flex flex-col gap-sm sm:flex-row">
        <Button size="lg" fullWidth>
          {t.addMove}
        </Button>
        <Button variant="secondary" size="lg" fullWidth>
          {t.ics}
        </Button>
      </div>
    </ToolShell>
  );
}

function MonthCell({ cell, first }: { cell: MonthCellVM; first: boolean }) {
  const short = cell.short > 0;
  return (
    <li
      className={cx(
        'flex min-h-20 flex-col justify-between gap-xs rounded-md p-sm text-xs',
        short ? 'bg-surface-strong ring-2 ring-text' : 'bg-positive-soft',
        first && 'ring-4',
      )}
    >
      <span className="font-semibold">{cell.month}</span>
      {cell.bill > 0 && <span className="tabular-nums text-text-muted">{formatMoney(cell.bill)}</span>}
      {short && <span className="font-bold tabular-nums">−{formatMoney(cell.short)}</span>}
    </li>
  );
}
