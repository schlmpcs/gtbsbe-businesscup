// S9 Statement upload (Design v3, Figma 194:1627): "Optional" over the headline; a white card with a
// dashed orange border (drop a CSV on it, or pick one: read and categorized by the T6/T7 pipeline
// behind the view-model's readFile, or "Try with sample statement" through the same path), "What we keep" on the right, then the review of categorized
// months before they enter the profile. Connecting a bank app is not built, so it is not offered
// here (decision D-7: no dead buttons in the main flow).
import { useId, useState } from 'react';
import { common, ladder } from '@/copy';
import { Art, BarBreakdown, Button, Card, cx, formatMoney, Row, Stack } from '@/ui-kit';
import type {
  LadderProgressVM, StatementMonthVM, StatementReadVM, StatementUploadError, StatementUploadVM,
} from '../model/types';
import { LadderShell } from './LadderShell';
import { WhatWeKeep } from './WhatWeKeep';

const t = ladder.upload;

function errorText(error: StatementUploadError | null): string {
  switch (error?.kind) {
    case 'unreadable':
      return t.errors.unreadable[error.reason];
    case 'badInput':
      return t.errors.badInput;
    case 'rateLimited':
      return t.errors.rateLimited;
    case 'network':
      return t.errors.network;
    default:
      return t.errors.unknown;
  }
}

export type StatementUploadProps = { vm: StatementUploadVM; progress: LadderProgressVM };

export function StatementUpload({ vm, progress }: StatementUploadProps) {
  const inputId = useId();
  const noteId = useId();
  const titleId = useId();
  const { readFile } = vm;
  const canRead = readFile !== null && vm.status !== 'reading';
  const [dragging, setDragging] = useState(false);

  return (
    <LadderShell screen="S9" progress={progress} loading={vm.status === 'loading'}>
      <div className="grid items-start gap-xl lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Stack gap="xl">
          <section
            aria-labelledby={titleId}
            onDragOver={(e) => {
              if (!canRead) return;
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              setDragging(false);
              if (!canRead) return;
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file && readFile) readFile(file);
            }}
            className={cx(
              'rounded-xl border-2 border-dashed border-primary p-xl shadow-md transition-colors',
              dragging ? 'bg-primary-soft' : 'bg-surface',
            )}
          >
            <div className="flex flex-col items-center gap-xl sm:flex-row">
              <Art name="upload" className="w-full max-w-(--container-3xs) shrink-0" imgClassName="aspect-square" />
              <div className="flex w-full min-w-0 flex-col gap-md">
                <h2 id={titleId} className="font-display text-3xl font-extrabold leading-tight">
                  {t.pickerTitle}
                </h2>
                <p id={noteId} className="text-sm text-text-muted">
                  {readFile === null ? t.pickerUnavailable : t.pickerHint}
                </p>
                <label htmlFor={inputId} className="sr-only">
                  {t.pickerLabel}
                </label>
                <input
                  id={inputId}
                  type="file"
                  accept=".csv,text/csv"
                  disabled={!canRead}
                  aria-describedby={noteId}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && readFile) readFile(file);
                    e.target.value = '';
                  }}
                  className="w-full text-sm text-text-muted file:mr-md file:cursor-pointer file:rounded-lg file:border-0 file:bg-ink file:px-xl file:py-md file:text-base file:font-bold file:text-on-primary disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
              {readFile !== null && (
                <div className="flex flex-col items-center gap-xs">
                  <Button variant="secondary" onClick={vm.trySample} disabled={vm.status === 'reading'}>
                    {t.trySample}
                  </Button>
                  <p className="text-xs text-text-muted">{t.trySampleHint}</p>
                </div>
              )}
            </div>
          </section>

          {vm.status === 'reading' && (
            <p role="status" className="rounded-xl bg-surface p-lg text-sm shadow-md">
              {t.reading}
            </p>
          )}

          {vm.status === 'error' && (
            <div role="alert" className="flex flex-col gap-sm rounded-xl border-2 border-negative bg-surface p-lg">
              <p className="text-sm">{errorText(vm.error)}</p>
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
                {vm.lastRead && <ReadSummary read={vm.lastRead} />}
                {vm.pending.map((m) => (
                  <PendingMonth key={m.month} month={m} />
                ))}
                <Row gap="sm">
                  <Button variant="dark" size="lg" onClick={vm.apply}>
                    {t.apply}
                  </Button>
                  <Button size="lg" variant="ghost" onClick={vm.discard}>
                    {t.discard}
                  </Button>
                </Row>
              </Stack>
            </Card>
          )}

          {vm.status === 'applied' && (
            <p role="status" className="rounded-xl bg-positive-soft p-lg text-sm font-medium text-positive">
              {t.applied}
            </p>
          )}

          {vm.history.length > 0 && (
            <Stack gap="xs">
              <p className="text-sm">{t.history(vm.history)}</p>
              <p className="text-xs text-text-muted">{vm.hasDriftHistory ? t.driftReady : t.driftNotYet}</p>
            </Stack>
          )}
        </Stack>

        <WhatWeKeep keep={vm.whatWeKeep} sendsLabels={readFile !== null} />
      </div>
    </LadderShell>
  );
}

function ReadSummary({ read }: { read: StatementReadVM }) {
  return (
    <div className="flex flex-col gap-xs text-xs text-text-muted" data-testid="statement-read">
      <p>{t.readSummary(read.transactions, read.from, read.to)}</p>
      <details>
        <summary className="cursor-pointer">{t.readMore}</summary>
        <div className="mt-xs flex flex-col gap-xs">
          {(read.skippedPending > 0 || read.skippedOther > 0) && (
            <p>{t.skipped(read.skippedPending, read.skippedOther)}</p>
          )}
          <p>{t.categorizedBy[read.categorizedBy]}</p>
          <p>{t.excludedNote}</p>
        </div>
      </details>
    </div>
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
