'use client';

// The form: ZIP, household, and up to four monthly amounts. Everything is optional except a ZIP and one
// amount. Boxes filled from the profile say so; editing never changes the profile.
import type { InputHTMLAttributes } from 'react';
import { overpaying as t } from '@/copy';
import { Card, Choice, Field, NumberInput, Stack, cx, useFieldControl } from '@/ui-kit';
import type { BenchmarkLine, KidAge, OverpayingVM } from '../model/types';

const LINES: readonly BenchmarkLine[] = ['rent', 'carInsurance', 'groceries', 'childcare'];
const KID_AGES: readonly KidAge[] = ['infant', 'toddler', 'preschool', 'schoolAge'];

/** A single-line text box that picks up its label, hint and error from the surrounding <Field>. */
function ZipInput({
  value,
  onValueChange,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & { value: string; onValueChange: (v: string) => void }) {
  const field = useFieldControl();
  return (
    <input
      {...field}
      {...rest}
      type="text"
      inputMode="numeric"
      autoComplete="postal-code"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      className={cx(
        'w-full rounded-lg border-2 bg-surface px-md py-sm text-base tabular-nums',
        field['aria-invalid'] ? 'border-negative' : 'border-border',
      )}
    />
  );
}

export function InputsForm({ vm }: { vm: OverpayingVM }) {
  const { inputs, prefill, invalidFields, limits } = vm;
  const invalid = new Set<string>(invalidFields);
  return (
    <Card title={t.form.title} headingLevel={2}>
      <Stack gap="xl">
        <Field
          label={t.form.zip}
          hint={prefill.zip ? `${t.form.zipHint} ${t.form.fromProfile}.` : t.form.zipHint}
          error={invalid.has('zip') ? t.form.errors.zip : undefined}
        >
          <ZipInput value={inputs.zip} onValueChange={vm.setZip} placeholder={t.form.zipPlaceholder} maxLength={12} />
        </Field>

        <Stack gap="lg" as="fieldset" className="min-w-0 border-0 p-0">
          <legend className="mb-sm text-sm font-semibold">{t.form.householdTitle}</legend>
          <Choice
            legend={t.form.bedrooms}
            name="overpaying-bedrooms"
            value={String(inputs.bedrooms)}
            options={Array.from({ length: limits.bedrooms + 1 }, (_, n) => ({ value: String(n), label: t.form.bedroomOptions[n] ?? String(n) }))}
            onChange={(v) => vm.setBedrooms(Number(v))}
            hint={t.form.bedroomsHint}
          />
          <Choice
            legend={t.form.adults}
            name="overpaying-adults"
            value={String(inputs.adults)}
            options={Array.from({ length: limits.adults }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
            onChange={(v) => vm.setAdults(Number(v))}
          />
          <fieldset className="flex min-w-0 flex-col gap-sm">
            <legend className="mb-sm text-sm text-text-muted">{t.form.kidsTitle}</legend>
            <div className="grid grid-cols-2 gap-md">
              {KID_AGES.map((age) => (
                <Field key={age} label={t.form.kidAges[age]}>
                  <NumberInput
                    value={inputs.kids[age]}
                    onValueChange={(v) => vm.setKidCount(age, v ?? 0)}
                    min={0}
                    max={limits.kidsPerBand}
                    maxFractionDigits={0}
                  />
                </Field>
              ))}
            </div>
            <p className="text-xs text-text-muted">{t.form.kidsHint}</p>
          </fieldset>
        </Stack>

        <Stack gap="lg" as="fieldset" className="min-w-0 border-0 p-0">
          <legend className="text-sm font-semibold">{t.form.amountsTitle}</legend>
          <p className="text-xs text-text-muted">{t.form.amountsHint}</p>
          {LINES.map((line) => (
            <Field
              key={line}
              label={t.lines[line]}
              hint={prefill.amounts[line] ? t.form.fromProfile : undefined}
              isEstimate={prefill.amounts[line] === 'profileEstimate'}
              error={invalid.has(line) ? t.form.errors.amount : undefined}
            >
              <NumberInput
                value={inputs.amounts[line]}
                onValueChange={(v) => vm.setAmount(line, v)}
                prefix="$"
                suffix={t.form.perMonth}
                placeholder={t.form.amountPlaceholder}
              />
            </Field>
          ))}
        </Stack>

        <p className="text-xs text-text-muted">{t.form.noWriteBack}</p>
      </Stack>
    </Card>
  );
}
