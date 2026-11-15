'use client';

// /together: partner 1 adds their numbers and taps "Plan together". Step 1 of the invite
// flow; all data and actions come from useTogetherStart().
import { together as t } from '@/copy';
import { Art, Button, PageHeader, Stack } from '@/ui-kit';
import type { TogetherStartVM, VMError } from '../model/types';
import { PartnerForm } from './PartnerForm';
import { Steps } from './Steps';

export function errorText(error: VMError): string {
  if (error.kind === 'unavailable' || error.kind === 'network') return t.errors.unavailable;
  if (error.kind === 'rateLimited') return t.errors.rateLimited;
  if (error.kind === 'badInput') return t.errors.badInput;
  return t.errors.unknown;
}

export function TogetherStartScreen({ vm }: { vm: TogetherStartVM }) {
  const problem = vm.form.problem;
  return (
    <main className="mx-auto flex w-full max-w-(--container-3xl) flex-col gap-xl px-lg pb-2xl pt-md sm:pt-xl">
      <PageHeader
        eyebrow={t.eyebrow}
        title={t.title}
        intro={t.lead}
        className="animate-enter"
        aside={<Art name="duel-houses" className="hidden h-36 w-36 sm:block" />}
      />
      <Steps current={1} />
      {vm.ready ? (
        <Stack gap="lg">
          <PartnerForm vm={vm.form} />
          {vm.error && (
            <p role="alert" className="rounded-lg bg-surface p-lg text-sm font-medium text-negative" data-testid="together-error">
              {errorText(vm.error)}
            </p>
          )}
          <Button size="lg" onClick={vm.create} disabled={problem !== null || vm.creating} data-testid="together-create" className="max-sm:w-full">
            {vm.creating ? t.start.creating : t.start.cta}
          </Button>
          <p className="text-xs text-text-muted">
            {t.privacy} {t.storage[vm.storage]}
          </p>
        </Stack>
      ) : (
        <p role="status">{t.loading}</p>
      )}
    </main>
  );
}
