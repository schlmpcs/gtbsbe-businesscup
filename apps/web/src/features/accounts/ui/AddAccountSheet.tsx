'use client';

// Add account (P2): pick a type, then fill its form. A sheet from the bottom on phones, a dialog on wider
// screens. Presentational: the fields, their errors and the estimate tags come from useAddAccount.
import { accounts as t, bankDemo, planner } from '@/copy';
import { Button, buttonClassName, cx, Field, Sheet, Stack, Tag, useFieldControl } from '@/ui-kit';
import type { AddAccountFieldVM, AddAccountVM } from '../model/types';
import type { LinkComponent } from './AccountsScreen';

export type AddAccountSheetProps = {
  open: boolean;
  vm: AddAccountVM;
  uploadHref: string;
  Link: LinkComponent;
  /** Opens the demo bank link (labelled a demo; the route renders it). Without it the row shows "Coming soon". */
  onConnectBank?: () => void;
};

const FORM_ID = 'add-account-form';

export function AddAccountSheet({ open, vm, uploadHref, Link, onConnectBank }: AddAccountSheetProps) {
  const isForm = vm.step === 'form' && vm.group !== null;
  return (
    <Sheet
      open={open}
      onClose={vm.close}
      title={vm.title ?? t.pickType}
      footer={
        isForm ? (
          <div className="flex justify-between gap-sm">
            <Button variant="ghost" onClick={vm.back}>
              {t.back}
            </Button>
            <Button type="submit" form={FORM_ID} data-testid="add-account-submit">
              {t.submit}
            </Button>
          </div>
        ) : undefined
      }
    >
      {isForm ? <AccountForm vm={vm} /> : <PickType vm={vm} uploadHref={uploadHref} Link={Link} onConnectBank={onConnectBank} />}
    </Sheet>
  );
}

function PickType({
  vm,
  uploadHref,
  Link,
  onConnectBank,
}: {
  vm: AddAccountVM;
  uploadHref: string;
  Link: LinkComponent;
  onConnectBank?: () => void;
}) {
  const sides = (['asset', 'liability'] as const).map((kind) => ({ kind, groups: vm.groups.filter((g) => g.kind === kind) }));
  return (
    <Stack gap="xl">
      {sides.map((side) => (
        <section key={side.kind} className="flex flex-col gap-sm">
          <h3 className="text-sm font-medium text-text-muted">{side.kind === 'asset' ? planner.assets : planner.liabilities}</h3>
          <div className="grid grid-cols-2 gap-sm sm:grid-cols-3">
            {side.groups.map((g) => (
              <button
                key={g.group}
                type="button"
                onClick={() => vm.pickType(g.group)}
                data-testid={`add-account-type-${g.group}`}
                className="min-h-11 rounded-lg border-2 border-border bg-surface px-md py-md text-left font-semibold hover:border-text"
              >
                {t.groups[g.group]}
              </button>
            ))}
          </div>
        </section>
      ))}
      <div className="flex flex-col gap-sm border-t border-border pt-lg">
        {onConnectBank ? (
          <div className="flex flex-wrap items-center justify-between gap-md rounded-lg border-2 border-primary bg-surface p-md">
            <span className="flex min-w-0 flex-1 flex-col gap-xs">
              <span className="flex flex-wrap items-center gap-sm">
                <span className="font-semibold">{bankDemo.entry.short}</span>
                <Tag className="border-primary font-bold text-primary">{bankDemo.badge}</Tag>
              </span>
              <span className="text-sm text-text-muted">{bankDemo.disclaimer}</span>
            </span>
            <Button size="sm" onClick={onConnectBank} data-testid="add-account-connect-bank">
              {bankDemo.entry.cta}
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-md rounded-lg bg-surface-strong p-md opacity-70" aria-disabled="true">
            <span className="font-semibold">{t.addMenu.connectBank}</span>
            <Tag>{t.addMenu.connectBankNote}</Tag>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-md rounded-lg bg-surface-strong p-md">
          <span className="flex min-w-0 flex-col">
            <span className="font-semibold">{t.addMenu.importCsv}</span>
            <span className="text-sm text-text-muted">{t.addMenu.importCsvNote}</span>
          </span>
          <Link href={uploadHref} className={buttonClassName({ variant: 'secondary', size: 'sm' })}>
            {t.screen.importCta}
          </Link>
        </div>
      </div>
    </Stack>
  );
}

function AccountForm({ vm }: { vm: AddAccountVM }) {
  return (
    <form
      id={FORM_ID}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        vm.submit();
      }}
      className="flex flex-col gap-lg"
      data-testid="add-account-form"
    >
      {vm.fields.map((f) => (
        <FieldRow key={f.id} field={f} vm={vm} />
      ))}
    </form>
  );
}

function FieldRow({ field, vm }: { field: AddAccountFieldVM; vm: AddAccountVM }) {
  return (
    <div className="flex flex-col gap-xs">
      <Field label={t.fields[field.labelKey]} hint={field.hint ?? undefined} error={field.error ? t.errors[field.error] : undefined} isEstimate={field.isEstimate}>
        {field.input === 'select' ? (
          <SelectControl field={field} onChange={(v) => vm.setField(field.id, v)} />
        ) : (
          <TextControl field={field} onChange={(v) => vm.setField(field.id, v)} />
        )}
      </Field>
      {field.canBeEstimate && !field.defaulted && (
        <label className="flex min-h-11 items-center gap-sm text-sm">
          <input
            type="checkbox"
            checked={field.isEstimate}
            onChange={(e) => vm.setEstimate(field.id, e.target.checked)}
            className="size-5 accent-primary"
          />
          {t.form.notSure}
        </label>
      )}
    </div>
  );
}

const INPUT = 'w-full min-h-11 rounded-lg border-2 bg-surface px-md py-sm text-base';

function TextControl({ field, onChange }: { field: AddAccountFieldVM; onChange: (value: string) => void }) {
  const control = useFieldControl();
  const numeric = field.input === 'money' || field.input === 'percent';
  return (
    <div className="relative">
      {field.input === 'money' && <span aria-hidden="true" className="pointer-events-none absolute top-1/2 left-md -translate-y-1/2 text-text-muted">$</span>}
      <input
        {...control}
        type="text"
        inputMode={numeric ? 'decimal' : 'text'}
        autoComplete="off"
        name={field.id}
        value={field.value}
        required={field.required}
        placeholder={field.placeholder ?? (field.input === 'money' ? t.form.moneyPlaceholder : undefined)}
        onChange={(e) => onChange(e.target.value)}
        data-testid={`add-account-${field.id}`}
        className={cx(
          INPUT,
          field.input === 'money' && 'pl-2xl',
          field.input === 'percent' && 'pr-2xl',
          numeric && 'tabular-nums',
          field.error ? 'border-negative' : 'border-border',
        )}
      />
      {field.input === 'percent' && <span aria-hidden="true" className="pointer-events-none absolute top-1/2 right-md -translate-y-1/2 text-text-muted">%</span>}
    </div>
  );
}

function SelectControl({ field, onChange }: { field: AddAccountFieldVM; onChange: (value: string) => void }) {
  const control = useFieldControl();
  return (
    <select
      {...control}
      name={field.id}
      value={field.value}
      onChange={(e) => onChange(e.target.value)}
      data-testid={`add-account-${field.id}`}
      className={cx(INPUT, field.error ? 'border-negative' : 'border-border')}
    >
      {(field.options ?? []).map((o) => (
        <option key={o} value={o}>
          {o in t.loanKinds ? t.loanKinds[o as keyof typeof t.loanKinds] : o}
        </option>
      ))}
    </select>
  );
}
