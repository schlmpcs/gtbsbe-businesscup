'use client';

// /together: partner 1 adds their numbers and taps "Plan together". Placeholder UI until the
// designer's frame lands; all data and actions come from useTogetherStart().
import { together as t } from '@/copy';
import { Art, Button, PageHeader, Stack } from '@/ui-kit';
import type { TogetherStartVM, VMError } from '../model/types';
import { PartnerForm } from './PartnerForm';

export function errorText(error: VMError): string {
  if (error.kind === 'unavailable' || error.kind === 'network') return t.errors.unavailable;
  if (error.kind === 'rateLimited') return t.errors.rateLimited;
  if (error.kind === 'badInput') return t.errors.badInput;
  return t.errors.unknown;
}

export function TogetherStartScreen({ vm }: { vm: TogetherStartVM }) {
  const problem = vm.form.problem;
  return (
    <main className="mx-auto flex w-full max-w-(--container-3xl) flex-col gap-xl px-lg py-xl sm:py-3xl">
      <PageHeader eyebrow={t.eyebrow} title={t.title} intro={t.lead} aside={<Art name="duel-houses" className="hidden h-40 w-40 sm:block" />} />
      <p className="rounded-lg bg-surface-strong p-lg text-sm">
        {t.privacy} {t.storage[vm.storage]}
      </p>
      {vm.ready ? (
        <Stack gap="lg">
          <PartnerForm vm={vm.form} />
          {vm.error && (
            <p role="alert" className="rounded-lg bg-surface p-lg text-sm font-medium text-negative" data-testid="together-error">
              {errorText(vm.error)}
            </p>
          )}
          <Button size="lg" onClick={vm.create} disabled={problem !== null || vm.creating} data-testid="together-create">
            {vm.creating ? t.start.creating : t.start.cta}
          </Button>
          {problem === 'takeHomePay' && vm.form.problemShown === null && (
            <p className="text-sm text-text-muted" data-testid="together-need-pay">
              {t.start.needPay}
            </p>
          )}
        </Stack>
      ) : (
        <p role="status">{t.loading}</p>
      )}
    </main>
  );
}
