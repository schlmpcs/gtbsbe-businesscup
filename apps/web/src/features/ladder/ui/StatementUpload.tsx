// S9 Statement upload (Figma S09): the dashed orange drop tile with the file picker (read and
// categorized by the T6/T7 pipeline behind the view-model's readFile), "What we keep", the black "connect your bank app"
// card (not built yet, shown as coming soon), the review of categorized months before they enter the
// profile, and what the statements have added so far in the black score bar.
import { useId } from 'react';
import { common, ladder } from '@/copy';
import { Art, BarBreakdown, Button, Card, formatMoney, Row, Scoreboard, Stack } from '@/ui-kit';
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
  const bankTitleId = useId();
  const bankNoteId = useId();
  const { readFile } = vm;

  return (
    <LadderShell screen="S9" progress={progress} loading={vm.status === 'loading'}>
      <div className="grid items-start gap-2xl lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Stack gap="xl">
          <Card
            as="section"
            aria-labelledby={titleId}
            style={{ transform: 'rotate(-0.4deg)' }}
            className="border-2 border-dashed border-primary"
          >
            <div className="flex flex-col items-center gap-lg text-center">
              <Art name="upload" className="w-full max-w-(--container-3xs)" imgClassName="aspect-square" />
              <h2 id={titleId} className="font-display text-3xl font-extrabold leading-tight">
                {t.pickerTitle}
              </h2>
              <div className="flex w-full max-w-(--container-sm) flex-col gap-sm text-left">
                <label htmlFor={inputId} className="sr-only">
                  {t.pickerLabel}
                </label>
                <input
                  id={inputId}
                  type="file"
                  accept=".csv,text/csv"
                  disabled={readFile === null || vm.status === 'reading'}
                  aria-describedby={noteId}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && readFile) readFile(file);
                    e.target.value = '';
                  }}
                  className="w-full text-sm text-text-muted file:mr-md file:cursor-pointer file:rounded-full file:border-0 file:bg-ink file:px-xl file:py-md file:text-base file:font-bold file:text-on-primary disabled:cursor-not-allowed disabled:opacity-60"
                />
                <p id={noteId} className="text-xs text-text-muted">
                  {readFile === null ? t.pickerUnavailable : t.pickerHint}
                </p>
              </div>
            </div>
          </Card>

          {vm.status === 'reading' && (
            <p role="status" className="rounded-xl bg-surface p-lg text-sm">
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
                  <Button size="lg" onClick={vm.apply}>
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

        <Stack gap="xl">
          <WhatWeKeep keep={vm.whatWeKeep} sendsLabels={readFile !== null} />

          <section
            aria-labelledby={bankTitleId}
            className="flex flex-col gap-sm rounded-xl bg-ink p-lg text-on-primary shadow-md"
          >
            <h2 id={bankTitleId} className="flex items-baseline gap-sm font-display text-xl font-extrabold leading-tight">
              <span className="text-sm font-normal text-on-primary/60">{t.bank.or}</span>
              {t.bank.title}
            </h2>
            <p id={bankNoteId} className="text-xs text-on-primary/70">
              {t.bank.note}
            </p>
            <Button variant="ghost" fullWidth disabled aria-describedby={bankNoteId}>
              {t.bank.button} · {t.bank.soon}
            </Button>
          </section>
        </Stack>
      </div>

      <Scoreboard
        label={t.scoreLabel}
        items={[
          { id: 'months', value: vm.history.length, label: t.monthsScore(vm.history.length), tone: 'positive' },
          {
            id: 'categories',
            value: vm.whatWeKeep.categories.length,
            label: t.categoriesScore(vm.whatWeKeep.categories.length),
          },
        ]}
      />
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
