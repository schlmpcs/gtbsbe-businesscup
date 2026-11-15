'use client';

// The manual add line (Transactions, and Account detail through a slot). Presentational: it holds what
// is typed and hands the view-model a NewTransactionInput; the view-model says whether it was usable.
import { useState } from 'react';
import { planner, transactions as t } from '@/copy';
import { Button, Choice, Field, useFieldControl } from '@/ui-kit';
import type { NewTransactionInput, StatementClass } from '../model/types';
import { ALL_CATEGORIES } from './TransactionList';

export type AddTransactionFormProps = {
  /** Adds the line; returns an id, or null when the input is not usable. */
  onAdd: (input: NewTransactionInput) => string | null;
  /** The accounts to pick from; omit to hide the picker (Account detail adds to its own account). */
  accounts?: { id: string; name: string }[];
  /** 'YYYY-MM-DD' the date starts at (today, from the route). */
  defaultDate?: string;
  /** Called after a line was added, and on Cancel. */
  onDone?: () => void;
};

type Direction = 'out' | 'in';
const INPUT = 'w-full min-h-11 rounded-lg border-2 border-border bg-surface px-md py-sm text-base';

function Input(props: { value: string; onChange: (v: string) => void; type?: string; inputMode?: 'decimal' | 'text'; testId: string }) {
  const control = useFieldControl();
  return (
    <input
      {...control}
      type={props.type ?? 'text'}
      inputMode={props.inputMode}
      autoComplete="off"
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      data-testid={props.testId}
      className={INPUT}
    />
  );
}

function Select<T extends string>(props: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; testId: string }) {
  const control = useFieldControl();
  return (
    <select {...control} value={props.value} onChange={(e) => props.onChange(e.target.value as T)} data-testid={props.testId} className={INPUT}>
      {props.options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function AddTransactionForm({ onAdd, accounts, defaultDate = '', onDone }: AddTransactionFormProps) {
  const [date, setDate] = useState(defaultDate);
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<Direction>('out');
  const [category, setCategory] = useState<StatementClass>('other');
  const [accountId, setAccountId] = useState<string>('');
  const [invalid, setInvalid] = useState(false);

  const submit = () => {
    const typed = Number(amount.replace(/[$,\s]/g, ''));
    const size = amount.trim() === '' ? Number.NaN : Math.abs(typed);
    const id = onAdd({
      date,
      label,
      amount: direction === 'out' ? -size : size,
      category,
      ...(accountId === '' ? {} : { accountId }),
    });
    if (id === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setLabel('');
    setAmount('');
    onDone?.();
  };

  return (
    <form
      noValidate
      aria-label={t.addForm.title}
      data-testid="add-transaction-form"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-lg"
    >
      <div className="grid grid-cols-1 gap-lg sm:grid-cols-2">
        <Field label={t.addForm.date}>
          <Input type="date" value={date} onChange={setDate} testId="add-transaction-date" />
        </Field>
        <Field label={t.addForm.label}>
          <Input value={label} onChange={setLabel} testId="add-transaction-label" />
        </Field>
        <Field label={t.addForm.amount}>
          <Input value={amount} onChange={setAmount} inputMode="decimal" testId="add-transaction-amount" />
        </Field>
        <Field label={t.addForm.category}>
          <Select
            value={category}
            onChange={setCategory}
            options={ALL_CATEGORIES.map((c) => ({ value: c, label: planner.categories[c] }))}
            testId="add-transaction-category"
          />
        </Field>
        {accounts && accounts.length > 0 && (
          <Field label={t.addForm.account}>
            <Select
              value={accountId}
              onChange={setAccountId}
              options={[{ value: '', label: t.addForm.noAccount }, ...accounts.map((a) => ({ value: a.id, label: a.name }))]}
              testId="add-transaction-account"
            />
          </Field>
        )}
      </div>
      <Choice
        legend={t.addForm.direction}
        name="add-transaction-direction"
        value={direction}
        options={(['out', 'in'] as const).map((d) => ({ value: d, label: t.addForm.directions[d] }))}
        onChange={setDirection}
      />
      {invalid && (
        <p role="alert" className="text-sm font-medium text-negative">
          {t.addForm.invalid}
        </p>
      )}
      <div className="flex flex-wrap gap-sm">
        <Button type="submit" data-testid="add-transaction-submit">
          {t.addForm.submit}
        </Button>
        {onDone && (
          <Button variant="ghost" onClick={onDone}>
            {t.addForm.cancel}
          </Button>
        )}
      </div>
    </form>
  );
}
