'use client';

// "Your numbers": the profile from this app (when the person made one) or quick inputs, a nickname
// and an optional shared goal. Presentational: everything comes from the PartnerFormVM.
import { together as t } from '@/copy';
import { Button, Card, Choice, Field, NumberInput, Stack, cx, formatMoney, formatRate, useFieldControl } from '@/ui-kit';
import type { PartnerFormVM, QuickField } from '../model/types';

function TextInput({ value, onValueChange, maxLength }: { value: string; onValueChange: (v: string) => void; maxLength: number }) {
  const field = useFieldControl();
  return (
    <input
      {...field}
      type="text"
      autoComplete="off"
      value={value}
      maxLength={maxLength}
      onChange={(e) => onValueChange(e.target.value)}
      className={cx('w-full rounded-lg border-2 bg-surface px-md py-sm text-base', field['aria-invalid'] ? 'border-negative' : 'border-border')}
    />
  );
}

const SPENDING: { field: QuickField; label: string; hint?: string }[] = [
  { field: 'rentUtilities', label: t.form.rentUtilities },
  { field: 'groceries', label: t.form.groceries },
  { field: 'childcare', label: t.form.childcare },
  { field: 'otherSpending', label: t.form.otherSpending, hint: t.form.otherSpendingHint },
];

function MoneyField({ vm, field, label, hint, error }: { vm: PartnerFormVM; field: QuickField; label: string; hint?: string; error?: string }) {
  return (
    <Field label={label} hint={hint} error={error}>
      <NumberInput
        value={vm.quick[field]}
        onValueChange={(v) => vm.setQuick(field, v)}
        prefix="$"
        maxFractionDigits={0}
        max={10_000_000}
        data-testid={`together-${field}`}
      />
    </Field>
  );
}

export function PartnerForm({ vm, goalKeepHint = false }: { vm: PartnerFormVM; goalKeepHint?: boolean }) {
  return (
    <Card title={t.form.title} headingLevel={2} data-testid="together-form">
      <Stack gap="xl">
        <Field label={t.form.nickname} hint={t.form.nicknameHint} error={vm.problemShown === 'nickname' ? t.form.problems.nickname : undefined}>
          <TextInput value={vm.nickname} onValueChange={vm.setNickname} maxLength={40} />
        </Field>

        {vm.hasProfile && (
          <Choice
            legend={t.form.sourceLabel}
            name="together-source"
            value={vm.source}
            options={[
              { value: 'profile', label: t.form.sourceProfile },
              { value: 'quick', label: t.form.sourceQuick },
            ]}
            onChange={vm.setSource}
          />
        )}

        {vm.source === 'profile' && vm.profileSummary ? (
          <p className="rounded-lg bg-surface-strong p-lg text-sm" data-testid="together-profile-summary">
            {t.form.profileSummary(formatMoney(vm.profileSummary.takeHomePay), formatMoney(vm.profileSummary.spending), vm.profileSummary.debts)}
          </p>
        ) : (
          <Stack gap="lg">
            {vm.fillExample && (
              <div className="flex flex-wrap items-center gap-sm rounded-lg bg-surface-strong p-md">
                <Button variant="secondary" onClick={vm.fillExample} data-testid="together-example">
                  {t.form.example}
                </Button>
                <span className="text-sm text-text-muted">{t.form.exampleHint}</span>
              </div>
            )}
            <MoneyField vm={vm} field="takeHomePay" label={t.form.takeHomePay} hint={t.form.takeHomePayHint} error={vm.problemShown === 'takeHomePay' ? t.form.problems.takeHomePay : undefined} />
            <p className="text-sm text-text-muted">{t.form.sharedHint}</p>
            <div className="grid gap-lg sm:grid-cols-2">
              {SPENDING.map((s) => (
                <MoneyField key={s.field} vm={vm} field={s.field} label={s.label} hint={s.hint} />
              ))}
              <MoneyField vm={vm} field="cash" label={t.form.cash} />
              <MoneyField vm={vm} field="retirement" label={t.form.retirement} />
              <MoneyField vm={vm} field="debtBalance" label={t.form.debtBalance} />
              <Field
                label={t.form.debtApr}
                hint={t.form.debtAprHint(formatRate(vm.defaultApr.value, 2), vm.defaultApr.sourceName, vm.defaultApr.year)}
                isEstimate={vm.quick.debtBalance !== null && vm.quick.debtBalance > 0 && vm.quick.debtApr === null}
              >
                <NumberInput value={vm.quick.debtApr} onValueChange={(v) => vm.setQuick('debtApr', v)} percent max={1} suffix="%" />
              </Field>
              <Field
                label={t.form.debtPayment}
                hint={t.form.debtPaymentHint}
                isEstimate={vm.quick.debtBalance !== null && vm.quick.debtBalance > 0 && vm.quick.debtPayment === null}
              >
                <NumberInput value={vm.quick.debtPayment} onValueChange={(v) => vm.setQuick('debtPayment', v)} prefix="$" maxFractionDigits={0} max={10_000_000} />
              </Field>
            </div>
          </Stack>
        )}

        <Stack gap="md" as="fieldset" className="min-w-0 border-0 p-0">
          <legend className="mb-sm text-sm font-semibold">{t.form.goalTitle}</legend>
          <div className="grid gap-lg sm:grid-cols-2">
            <Field label={t.form.goalTarget} error={vm.problemShown === 'goal' ? t.form.problems.goal : undefined} hint={goalKeepHint ? t.form.goalKeepHint : undefined}>
              <NumberInput value={vm.goal.target} onValueChange={(v) => vm.setGoal('target', v)} prefix="$" maxFractionDigits={0} max={100_000_000} />
            </Field>
            <Field label={t.form.goalYears}>
              <NumberInput value={vm.goal.years} onValueChange={(v) => vm.setGoal('years', v)} maxFractionDigits={0} max={30} />
            </Field>
          </div>
        </Stack>
      </Stack>
    </Card>
  );
}
