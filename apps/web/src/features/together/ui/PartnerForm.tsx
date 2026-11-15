'use client';

// "Your numbers": the profile from this app (when the person made one) or quick inputs, a nickname
// and an optional shared goal. Presentational: everything comes from the PartnerFormVM.
import { together as t } from '@/copy';
import { Card, Choice, Field, NumberInput, Stack, cx, formatMoney, formatRate, useFieldControl } from '@/ui-kit';
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

const MORE: { field: QuickField; label: string; hint?: string }[] = [
  { field: 'childcare', label: t.form.childcare },
  { field: 'otherSpending', label: t.form.otherSpending, hint: t.form.otherSpendingHint },
  { field: 'cash', label: t.form.cash },
  { field: 'retirement', label: t.form.retirement },
  { field: 'debtBalance', label: t.form.debtBalance },
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

const DISCLOSURE = 'group rounded-lg border border-border bg-bg/60 open:bg-transparent';
const SUMMARY =
  'flex min-h-11 cursor-pointer list-none items-center justify-between gap-md px-md py-sm [&::-webkit-details-marker]:hidden';

function Chevron() {
  return (
    <span aria-hidden="true" className="text-text-muted transition-transform group-open:rotate-180 motion-reduce:transition-none">
      ▾
    </span>
  );
}

export function PartnerForm({ vm, goalKeepHint = false }: { vm: PartnerFormVM; goalKeepHint?: boolean }) {
  const problem = vm.showProblem ? vm.problem : null;
  return (
    <Card title={t.form.title} headingLevel={2} data-testid="together-form">
      <Stack gap="xl">
        <Field label={t.form.nickname} hint={t.form.nicknameHint} error={problem === 'nickname' ? t.form.problems.nickname : undefined}>
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
            <p className="text-sm text-text-muted">{t.form.essentialsHint}</p>
            <MoneyField vm={vm} field="takeHomePay" label={t.form.takeHomePay} hint={t.form.takeHomePayHint} error={problem === 'takeHomePay' ? t.form.problems.takeHomePay : undefined} />
            <div className="grid gap-lg sm:grid-cols-2">
              <MoneyField vm={vm} field="rentUtilities" label={t.form.rentUtilities} />
              <MoneyField vm={vm} field="groceries" label={t.form.groceries} />
            </div>
            <p className="text-sm text-text-muted">{t.form.sharedHint}</p>
            <details className={DISCLOSURE} data-testid="together-more">
              <summary className={SUMMARY}>
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-semibold">{t.form.moreTitle}</span>
                  <span className="text-xs text-text-muted">{t.form.moreHint(vm.filledOptional)}</span>
                </span>
                <Chevron />
              </summary>
              <div className="grid gap-lg px-md pb-lg pt-sm sm:grid-cols-2">
                {MORE.map((s) => (
                  <MoneyField key={s.field} vm={vm} field={s.field} label={s.label} hint={s.hint} />
                ))}
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
            </details>
          </Stack>
        )}

        <details className={DISCLOSURE} data-testid="together-goal-form">
          <summary className={SUMMARY}>
            <span className="text-sm font-semibold">{t.form.goalTitle}</span>
            <Chevron />
          </summary>
          <div className="grid gap-lg px-md pb-lg pt-sm sm:grid-cols-2">
            <Field label={t.form.goalTarget} error={problem === 'goal' ? t.form.problems.goal : undefined} hint={goalKeepHint ? t.form.goalKeepHint : undefined}>
              <NumberInput value={vm.goal.target} onValueChange={(v) => vm.setGoal('target', v)} prefix="$" maxFractionDigits={0} max={100_000_000} />
            </Field>
            <Field label={t.form.goalYears}>
              <NumberInput value={vm.goal.years} onValueChange={(v) => vm.setGoal('years', v)} maxFractionDigits={0} max={30} />
            </Field>
          </div>
        </details>
      </Stack>
    </Card>
  );
}
