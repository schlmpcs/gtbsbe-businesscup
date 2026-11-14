'use client';

import { afford as t } from '@/copy';
import { Card, Field, NumberInput, Stack } from '@/ui-kit';
import type { AffordVM, PayWithChoice, Purchase } from '../model/types';
import { Choice, TextInput } from './controls';

type RecurringChoice = 'once' | 'monthly' | 'yearly';

const toChoice = (r: Purchase['recurring']): RecurringChoice => (r === false ? 'once' : r);
const fromChoice = (c: RecurringChoice): Purchase['recurring'] => (c === 'once' ? false : c);

export type PurchaseFormProps = Pick<
  AffordVM,
  'form' | 'invalidFields' | 'setLabel' | 'setAmount' | 'setRecurring' | 'setPayWith' | 'setLoan'
>;

/** The purchase: what, how much, how often and how it's paid (with loan terms for a loan). */
export function PurchaseForm({ form, invalidFields, setLabel, setAmount, setRecurring, setPayWith, setLoan }: PurchaseFormProps) {
  const error = (path: string) => (invalidFields.includes(path) ? (t.form.errors[path] ?? t.form.errors.payWith) : undefined);

  return (
    <Card title={t.form.title}>
      <form onSubmit={(e) => e.preventDefault()} noValidate>
        <Stack gap="lg">
          <Field label={t.form.label} error={error('label')}>
            <TextInput name="label" value={form.label} onValueChange={setLabel} placeholder={t.form.labelPlaceholder} maxLength={120} />
          </Field>
          <Field label={t.form.amount} hint={t.form.amountHint} error={error('amount')}>
            <NumberInput name="amount" value={form.amount} onValueChange={setAmount} prefix="$" />
          </Field>
          <Choice<RecurringChoice>
            legend={t.form.recurring}
            name="recurring"
            value={toChoice(form.recurring)}
            onChange={(c) => setRecurring(fromChoice(c))}
            options={[
              { value: 'once', label: t.form.recurringOptions.once },
              { value: 'monthly', label: t.form.recurringOptions.monthly },
              { value: 'yearly', label: t.form.recurringOptions.yearly },
            ]}
          />
          <Choice<PayWithChoice>
            legend={t.form.payWith}
            name="payWith"
            value={form.payWith}
            onChange={setPayWith}
            hint={t.form.payWithHints[form.payWith]}
            options={[
              { value: 'cash', label: t.form.payWithOptions.cash },
              { value: 'card', label: t.form.payWithOptions.card },
              { value: 'loan', label: t.form.payWithOptions.loan },
            ]}
          />
          {form.payWith === 'loan' && (
            <fieldset className="flex min-w-0 flex-col gap-md rounded-md bg-surface p-lg">
              <legend className="sr-only">{t.form.loanTitle}</legend>
              <p aria-hidden="true" className="text-sm font-semibold">
                {t.form.loanTitle}
              </p>
              <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
                <Field label={t.form.apr} hint={t.form.aprHint} error={error('loan.apr')}>
                  <NumberInput
                    name="apr"
                    percent
                    max={1}
                    suffix="%"
                    value={form.loan.apr}
                    onValueChange={(apr) => setLoan({ apr })}
                  />
                </Field>
                <Field label={t.form.termMonths} error={error('loan.termMonths')}>
                  <NumberInput
                    name="termMonths"
                    maxFractionDigits={0}
                    max={600}
                    suffix={t.form.termSuffix}
                    value={form.loan.termMonths}
                    onValueChange={(termMonths) => setLoan({ termMonths })}
                  />
                </Field>
                <Field label={t.form.downPayment} error={error('loan.downPayment')}>
                  <NumberInput
                    name="downPayment"
                    prefix="$"
                    value={form.loan.downPayment}
                    onValueChange={(downPayment) => setLoan({ downPayment: downPayment ?? 0 })}
                  />
                </Field>
                <Field label={t.form.fees} hint={t.form.feesHint} error={error('loan.fees')}>
                  <NumberInput name="fees" prefix="$" value={form.loan.fees} onValueChange={(fees) => setLoan({ fees: fees ?? 0 })} />
                </Field>
              </div>
            </fieldset>
          )}
        </Stack>
      </form>
    </Card>
  );
}
