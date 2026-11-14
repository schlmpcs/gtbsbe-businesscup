'use client';

// S10 "Coming up": future life events. Presentational (kit parts only; no Figma frame yet): the list,
// four shortcuts plus "Something else", one inline form, and the note for events that started. The
// view-model (useLifeEvents) prefills, validates and saves; the forecast above follows every change.
import { useId, useState } from 'react';
import { common, lifeEvents as t } from '@/copy';
import {
  Button, Choice, cx, EstimateTag, Field, formatMoney, formatMonthYear, NumberInput, SourceNote, useFieldControl,
} from '@/ui-kit';
import type {
  LifeEventCategory, LifeEventDraft, LifeEventErrors, LifeEventKind, LifeEventShortcutVM, LifeEventsVM, LifeEventVM, YearMonth,
} from '../model/types';

export type LifeEventsCardProps = { vm: LifeEventsVM; className?: string };

/** The open form: adding (from a shortcut or "Something else") or editing an event. */
type Editing =
  | { mode: 'add'; title: string; draft: LifeEventDraft; shortcut?: LifeEventShortcutVM }
  | { mode: 'edit'; id: string; title: string; draft: LifeEventDraft };

const KINDS = ['pay', 'spending', 'oneOff'] as const satisfies readonly LifeEventKind[];

export function LifeEventsCard({ vm, className }: LifeEventsCardProps) {
  const headingId = useId();
  const [editing, setEditing] = useState<Editing | null>(null);
  const ready = vm.status === 'ready';

  const open = (next: Editing) => setEditing(next);
  const close = () => setEditing(null);

  return (
    <section
      aria-labelledby={headingId}
      className={cx('flex flex-col gap-md rounded-xl bg-surface p-xl shadow-md', className)}
      data-testid="life-events"
    >
      <div>
        <h2 id={headingId} className="text-xl font-bold leading-tight">
          {t.title}
        </h2>
        <p className="mt-xs text-sm text-text-muted">{t.intro}</p>
      </div>

      {vm.foldedNotes.length > 0 && (
        <div role="status" className="flex flex-col gap-sm rounded-md bg-primary-soft p-md text-sm" data-testid="folded-notes">
          <ul className="flex flex-col gap-xs">
            {vm.foldedNotes.map((n, i) => (
              <li key={i}>{n.text}</li>
            ))}
          </ul>
          <Button variant="ghost" size="sm" className="self-start" onClick={vm.dismissFolded}>
            {t.foldedDismiss}
          </Button>
        </div>
      )}

      {ready && vm.events.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border">
          {vm.events.map((e) => (
            <EventRow
              key={e.id}
              event={e}
              onEdit={() => open({ mode: 'edit', id: e.id, title: t.form.editTitle(e.label), draft: e.draft })}
              onRemove={() => {
                if (editing?.mode === 'edit' && editing.id === e.id) close();
                vm.remove(e.id);
              }}
            />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-text-muted">{t.empty}</p>
      )}

      {editing ? (
        <EventForm
          // A new form (fresh fields and errors) per event or shortcut opened.
          key={editing.mode === 'edit' ? `edit:${editing.id}` : `add:${editing.title}`}
          vm={vm}
          editing={editing}
          onDone={close}
        />
      ) : (
        <div className="flex flex-col gap-sm">
          <div className="flex flex-wrap gap-sm">
            {vm.shortcuts.map((s) => (
              <Button
                key={s.preset}
                variant="secondary"
                size="sm"
                disabled={!ready || !vm.canAdd}
                onClick={() => open({ mode: 'add', title: t.form.addTitle(t.shortcuts[s.preset]), draft: s.draft, shortcut: s })}
              >
                {t.shortcuts[s.preset]}
              </Button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              disabled={!ready || !vm.canAdd}
              onClick={() => open({ mode: 'add', title: t.form.addTitle(t.custom), draft: vm.custom })}
            >
              {t.custom}
            </Button>
          </div>
          {ready && !vm.canAdd && <p className="text-xs text-text-muted">{t.full(vm.maxEvents)}</p>}
        </div>
      )}

      <p className="text-xs text-text-muted">{t.todaysDollars}</p>
    </section>
  );
}

function EventRow({ event: e, onEdit, onRemove }: { event: LifeEventVM; onEdit: () => void; onRemove: () => void }) {
  const month = formatMonthYear(e.month);
  return (
    <li className="flex flex-wrap items-center justify-between gap-sm py-sm" data-testid="life-event">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-sm font-semibold">
          <span>{e.label}</span>
          {e.isEstimate && <EstimateTag />}
        </div>
        <p className="text-sm tabular-nums text-text-muted">{t.detail(e, formatMoney(e.amount), month)}</p>
      </div>
      <div className="flex gap-xs">
        <Button variant="ghost" size="sm" onClick={onEdit} aria-label={t.editLabel(e.label, month)}>
          {t.edit}
        </Button>
        <Button variant="ghost" size="sm" onClick={onRemove} aria-label={t.removeLabel(e.label, month)}>
          {t.remove}
        </Button>
      </div>
    </li>
  );
}

function MonthInput({ value, min, max, onChange }: { value: string; min: YearMonth; max: YearMonth; onChange: (v: string) => void }) {
  const control = useFieldControl();
  return (
    <input
      {...control}
      type="month"
      // Desktop Safari and Firefox show a plain text box for type="month": say the format it takes.
      placeholder="YYYY-MM"
      pattern="\d{4}-\d{2}"
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(e.target.value)}
      className={cx(
        'w-full rounded-md border bg-bg px-md py-sm text-base',
        control['aria-invalid'] ? 'border-negative' : 'border-border',
      )}
    />
  );
}

function CategorySelect({
  value, categories, onChange,
}: { value: LifeEventCategory; categories: readonly LifeEventCategory[]; onChange: (c: LifeEventCategory) => void }) {
  const control = useFieldControl();
  return (
    <select
      {...control}
      value={value}
      onChange={(e) => onChange(e.target.value as LifeEventCategory)}
      className="w-full rounded-md border border-border bg-bg px-md py-md text-base"
    >
      {categories.map((c) => (
        <option key={c} value={c}>
          {common.categories[c]}
        </option>
      ))}
    </select>
  );
}

function monthError(vm: LifeEventsVM, e: LifeEventErrors['month']): string | undefined {
  if (e === undefined) return undefined;
  return e === 'tooFar' ? t.errors.month.tooFar(vm.maxYearsAhead) : t.errors.month[e];
}

function amountError(vm: LifeEventsVM, kind: LifeEventKind, e: LifeEventErrors['amount']): string | undefined {
  if (e === undefined) return undefined;
  return e === 'tooLarge' ? t.errors.amount.tooLarge(formatMoney(vm.amountMax[kind])) : t.errors.amount[e];
}

function EventForm({ vm, editing, onDone }: { vm: LifeEventsVM; editing: Editing; onDone: () => void }) {
  const titleId = useId();
  const [draft, setDraft] = useState<LifeEventDraft>(editing.draft);
  const [tried, setTried] = useState(false);
  const [refused, setRefused] = useState<LifeEventErrors['event']>(undefined);
  const set = (patch: Partial<LifeEventDraft>) => setDraft((d) => ({ ...d, ...patch }));
  // Errors show once a save was tried, and then follow the fields as they change.
  const errors = tried ? vm.validate(draft) : null;
  const fixedKind = draft.preset !== undefined;
  const childcare = editing.mode === 'add' ? editing.shortcut?.childcare : undefined;

  const amountLabel =
    draft.kind === 'pay' ? t.form.amount.pay : draft.kind === 'spending' ? t.form.amount.spending(draft.category) : t.form.amount.oneOff;
  const amountHint =
    draft.kind === 'pay'
      ? t.form.payHint
      : draft.kind === 'spending'
        ? childcare
          ? childcare.basis === 'area'
            ? t.form.kidHint.area
            : t.form.kidHint.median(childcare.areaCount)
          : draft.preset === 'move'
            ? t.form.moveHint
            : t.form.spendingHint
        : undefined;

  const save = () => {
    setTried(true);
    const result = editing.mode === 'edit' ? vm.update(editing.id, draft) : vm.add(draft);
    setRefused(result?.event);
    if (result === null) onDone();
  };

  return (
    <form
      aria-labelledby={titleId}
      className="flex flex-col gap-md rounded-md border border-border p-md"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      noValidate
    >
      <h3 id={titleId} className="font-bold">
        {editing.title}
      </h3>

      {!fixedKind && (
        <Choice
          legend={t.form.kindLegend}
          name={`${titleId}-kind`}
          value={draft.kind}
          options={KINDS.map((k) => ({ value: k, label: t.form.kinds[k] }))}
          onChange={(kind) => set({ kind })}
        />
      )}
      {!fixedKind && draft.kind === 'spending' && (
        <Field label={t.form.category}>
          <CategorySelect value={draft.category} categories={vm.categories} onChange={(category) => set({ category })} />
        </Field>
      )}
      {!fixedKind && draft.kind === 'oneOff' && (
        <Choice
          legend={t.form.directionLegend}
          name={`${titleId}-direction`}
          value={draft.direction}
          options={(['cost', 'income'] as const).map((d) => ({ value: d, label: t.form.directions[d] }))}
          onChange={(direction) => set({ direction })}
        />
      )}

      <div className="grid gap-md sm:grid-cols-2">
        <Field label={draft.kind === 'oneOff' ? t.form.oneOffMonth : t.form.month} error={monthError(vm, errors?.month)}>
          <MonthInput value={draft.month} min={vm.monthRange.min} max={vm.monthRange.max} onChange={(month) => set({ month })} />
        </Field>
        <Field
          label={amountLabel}
          hint={amountHint}
          isEstimate={vm.isEstimate(draft)}
          error={amountError(vm, draft.kind, errors?.amount)}
        >
          <NumberInput
            value={draft.amount}
            min={0}
            prefix="$"
            suffix={draft.kind === 'oneOff' ? undefined : '/mo'}
            onValueChange={(amount) => set({ amount })}
          />
        </Field>
      </div>
      {childcare && draft.kind === 'spending' && <SourceNote source={childcare.source} />}
      {refused && (
        <p role="alert" className="text-sm font-medium text-negative">
          {refused === 'full' ? t.errors.event.full(vm.maxEvents) : t.errors.event.refused}
        </p>
      )}

      <div className="flex flex-wrap gap-sm">
        <Button type="submit" size="sm">
          {editing.mode === 'edit' ? t.form.save : t.form.add}
        </Button>
        <Button variant="ghost" size="sm" onClick={onDone}>
          {t.form.cancel}
        </Button>
      </div>
    </form>
  );
}
