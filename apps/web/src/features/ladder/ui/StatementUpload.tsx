// S9 Statement upload (Design v3, Figma 194:1627), statement first (JF6): the step opens with a fork.
// "Have a bank CSV?" (most accurate, about a minute) is a white card with a dashed orange border:
// drop a CSV on it, or pick one (read and categorized by the T6/T7 pipeline behind the view-model's
// readFile), or "Try with sample statement" through the same path. "No statement?" sits under it and
// leads to the sliders (S7), where the month can also be typed in words. "What we keep" is on the
// right. The review lists a few follow-up questions (what the statement can't settle, each one
// skippable) above the categorized months, which follow the answers before they enter the profile.
// Connecting a bank app is not built, so it is not offered here (decision D-7: no dead buttons).
// `findings` is the JF7 "We found" review of paychecks and debts (features/upload), shown above the
// months it was read from.
import { useId, useState, type ReactNode } from 'react';
import { common, ladder } from '@/copy';
import {
  Art, BarBreakdown, Button, Card, Choice, cx, Field, formatMoney, NumberInput, Row, Stack, Tag,
} from '@/ui-kit';
import type {
  LadderProgressVM, StatementMonthVM, StatementQuestionVM, StatementReadVM, StatementUploadError, StatementUploadVM,
} from '../model/types';
import { LadderShell } from './LadderShell';
import { WhatWeKeep } from './WhatWeKeep';

const t = ladder.upload;
const f = ladder.upload.fork;
const q = ladder.upload.questions;

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

export type StatementUploadProps = {
  vm: StatementUploadVM;
  progress: LadderProgressVM;
  /** Another feature's block for the statement's result (JF7: paychecks and debts found). */
  findings?: ReactNode;
};

export function StatementUpload({ vm, progress, findings }: StatementUploadProps) {
  const inputId = useId();
  const noteId = useId();
  const titleId = useId();
  const { readFile } = vm;
  const canRead = readFile !== null && vm.status !== 'reading';
  const [dragging, setDragging] = useState(false);

  const busy = vm.status === 'reading' || vm.status === 'review';

  return (
    // The "No statement?" card below is this step's way out by hand, so the footer has only the CTA.
    <LadderShell screen="S9" progress={progress} loading={vm.status === 'loading'} secondary={null}>
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
                <div className="flex flex-col gap-xs">
                  <Tag className="border-primary font-bold text-primary">{f.statementBadge}</Tag>
                  <h2 id={titleId} className="font-display text-3xl font-extrabold leading-tight">
                    {f.statementTitle}
                  </h2>
                  <p className="text-lg font-semibold">{t.pickerTitle}</p>
                </div>
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
                  {/* Outlined in ink: the screen's only orange button is the footer CTA. */}
                  <button
                    type="button"
                    onClick={vm.trySample}
                    disabled={vm.status === 'reading'}
                    className="inline-flex items-center justify-center rounded-lg border-2 border-ink px-lg py-md text-base font-bold text-text transition-colors hover:bg-bg disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t.trySample}
                  </button>
                  <p className="text-xs text-text-muted">{t.trySampleHint}</p>
                </div>
              )}
            </div>
          </section>

          {!busy && <ByHand href={progress.byHandHref} />}

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

          {vm.status !== 'reading' && vm.status !== 'error' && findings}

          {vm.status === 'review' && (
            <Card title={t.reviewTitle}>
              <Stack gap="lg">
                {vm.questions.length > 0 && <FollowUps vm={vm} />}
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

/** The other side of the fork: no statement at hand, so set the month by hand (S7). */
function ByHand({ href }: { href: string }) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-sm rounded-xl bg-surface p-lg shadow-md sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-xs">
        <h2 id={titleId} className="text-lg font-bold">
          {f.byHandTitle}
        </h2>
        <p className="text-sm text-text-muted">{f.byHandText}</p>
      </div>
      <a href={href} className="min-h-11 shrink-0 content-center text-base font-semibold text-text hover:text-primary">
        {f.byHandLink}
      </a>
    </section>
  );
}

/** "A few quick questions": each one answered with a category or an amount, or skipped. */
function FollowUps({ vm }: { vm: StatementUploadVM }) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-md rounded-xl border-2 border-primary bg-primary-soft p-lg">
      <div className="flex flex-col gap-xs">
        <h3 id={titleId} className="text-lg font-bold">
          {q.title}
        </h3>
        <p className="text-sm text-text-muted">{q.note}</p>
      </div>
      <ul className="flex flex-col gap-md">
        {vm.questions.map((question) => (
          <li key={question.id}>
            <Question question={question} vm={vm} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function questionText(question: StatementQuestionVM): string {
  if (question.question) return question.question;
  if (question.kind === 'missing' && question.category) return q.template.missing(common.categories[question.category]);
  if (question.kind === 'merchant' && question.merchant) return q.template.merchant(question.merchant);
  return q.template.cash;
}

function answerText(question: StatementQuestionVM): string | null {
  const a = question.answer;
  if (!a) return null;
  if (a.kind === 'skipped') return q.skipped;
  if (a.kind === 'amount') return q.answeredAmount(formatMoney(a.monthly));
  return q.answeredCategory(common.categories[a.category]);
}

function Question({ question, vm }: { question: StatementQuestionVM; vm: StatementUploadVM }) {
  const textId = useId();
  const name = useId();
  // The typed amount stays here until "Add it": a half-typed number never reaches the profile.
  const [draft, setDraft] = useState<number | null>(question.answer?.kind === 'amount' ? question.answer.monthly : null);
  const answered = answerText(question);
  const chosen = question.answer?.kind === 'category' ? question.answer.category : '';
  return (
    <div role="group" aria-labelledby={textId} className="flex flex-col gap-sm rounded-lg bg-surface p-md">
      <p id={textId} className="text-base font-semibold">
        {questionText(question)}
      </p>
      {question.monthly > 0 && (
        <p className="text-sm text-text-muted tabular-nums">{q.monthly(formatMoney(question.monthly))}</p>
      )}
      {question.kind === 'missing' ? (
        <Row gap="sm" className="items-end">
          <Field label={q.amountLabel} className="min-w-0 flex-1">
            <NumberInput
              value={draft}
              onValueChange={setDraft}
              min={vm.amountBounds.min}
              max={vm.amountBounds.max}
              maxFractionDigits={0}
              prefix="$"
              suffix="/mo"
            />
          </Field>
          <Button variant="dark" disabled={draft === null} onClick={() => draft !== null && vm.answerAmount(question.id, draft)}>
            {q.amountSave}
          </Button>
        </Row>
      ) : (
        <Choice<string>
          legend={q.optionsLegend}
          name={name}
          value={chosen}
          options={question.options.map((c) => ({ value: c, label: common.categories[c] }))}
          onChange={(c) => {
            const category = question.options.find((o) => o === c);
            if (category) vm.answerCategory(question.id, category);
          }}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-sm">
        <p role="status" className="text-sm text-text-muted">
          {answered}
        </p>
        {question.answer?.kind !== 'skipped' && (
          <Button size="sm" variant="ghost" onClick={() => vm.skipQuestion(question.id)}>
            {q.skip}
          </Button>
        )}
      </div>
    </div>
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
      {!m.averaged && <p className="text-xs text-text-muted">{t.partialMonth}</p>}
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
