// S9 Statement upload: the file picker (unavailable until the T6/T7 reader is wired into the
// view-model), the review of categorized months before they enter the profile, and "What we keep".
import { useId } from 'react';
import { common, ladder } from '@/copy';
import { BarBreakdown, Button, Card, formatMoney, Row, Stack } from '@/ui-kit';
import type { LadderProgressVM, StatementMonthVM, StatementUploadVM } from '../model/types';
import { LadderShell } from './LadderShell';
import { WhatWeKeep } from './WhatWeKeep';

const t = ladder.upload;

export type StatementUploadProps = { vm: StatementUploadVM; progress: LadderProgressVM };

export function StatementUpload({ vm, progress }: StatementUploadProps) {
  const inputId = useId();
  const noteId = useId();
  const { readFile } = vm;

  return (
    <LadderShell screen="S9" progress={progress} loading={vm.status === 'loading'}>
      <Card title={t.pickerTitle}>
        <Stack gap="sm">
          <label htmlFor={inputId} className="text-sm font-medium">
            {t.pickerLabel}
          </label>
          <input
            id={inputId}
            type="file"
            accept=".csv,text/csv"
            disabled={readFile === null}
            aria-describedby={noteId}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && readFile) readFile(file);
              e.target.value = '';
            }}
            className="w-full text-sm file:mr-md file:rounded-md file:border file:border-border file:bg-surface file:px-md file:py-sm disabled:cursor-not-allowed disabled:opacity-60"
          />
          <p id={noteId} className="text-xs text-text-muted">
            {readFile === null ? t.pickerUnavailable : t.pickerHint}
          </p>
        </Stack>
      </Card>

      {vm.status === 'error' && (
        <div role="alert" className="flex flex-col gap-sm rounded-md border border-negative bg-surface p-md">
          <p className="text-sm">{vm.error?.kind === 'badInput' ? t.errors.badInput : t.errors.unknown}</p>
          <Row>
            <Button size="sm" variant="ghost" onClick={vm.discard}>
              {t.dismiss}
            </Button>
          </Row>
        </div>
      )}

      {vm.status === 'review' && (
        <Card title={t.reviewTitle}>
          <Stack gap="lg">
            <p className="text-sm text-text-muted">{t.reviewNote}</p>
            {vm.pending.map((m) => (
              <PendingMonth key={m.month} month={m} />
            ))}
            <Row gap="sm">
              <Button onClick={vm.apply}>{t.apply}</Button>
              <Button variant="secondary" onClick={vm.discard}>
                {t.discard}
              </Button>
            </Row>
          </Stack>
        </Card>
      )}

      {vm.status === 'applied' && (
        <p role="status" className="rounded-md bg-surface p-md text-sm font-medium text-positive">
          {t.applied}
        </p>
      )}

      {vm.history.length > 0 && (
        <Stack gap="xs">
          <p className="text-sm">{t.history(vm.history)}</p>
          <p className="text-xs text-text-muted">{vm.hasDriftHistory ? t.driftReady : t.driftNotYet}</p>
        </Stack>
      )}

      <WhatWeKeep keep={vm.whatWeKeep} sendsLabels={readFile !== null} />
    </LadderShell>
  );
}

function PendingMonth({ month: m }: { month: StatementMonthVM }) {
  const label = t.monthLabel(m.month);
  const items = (Object.keys(m.totals) as (keyof StatementMonthVM['totals'])[])
    .filter((c) => m.totals[c] > 0)
    .map((c) => ({ id: c, label: common.categories[c], amount: m.totals[c] }));
  return (
    <section aria-label={label} className="flex flex-col gap-sm">
      <h3 className="text-base font-semibold">{label}</h3>
      <BarBreakdown label={label} items={items} total={m.total} />
      {m.detectedPay !== null && <p className="text-sm">{t.detectedPay(formatMoney(m.detectedPay))}</p>}
      {m.oneOffs.length > 0 && (
        <div className="flex flex-col gap-xs">
          <p className="text-xs font-medium text-text-muted">{t.oneOffsTitle}</p>
          <ul className="flex flex-col gap-xs text-xs text-text-muted">
            {m.oneOffs.map((o, i) => (
              <li key={`${o.label}-${i}`} className="flex justify-between gap-md">
                <span className="min-w-0 break-words">{o.label}</span>
                <span className="tabular-nums">{formatMoney(o.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
