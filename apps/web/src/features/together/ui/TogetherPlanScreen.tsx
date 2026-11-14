'use client';

// /together/<id>: the shared plan. Placeholder UI until the designer's frame lands; all data and
// actions come from useTogetherPlan(id).
import type { ReactNode } from 'react';
import { together as t } from '@/copy';
import { Button, Card, PageHeader, Stack, buttonClassName } from '@/ui-kit';
import type { ShareVM, TogetherPlanVM } from '../model/types';
import { PartnerForm } from './PartnerForm';
import { ResultView } from './ResultView';
import { errorText } from './TogetherStartScreen';

function SharePanel({ share, fixtures }: { share: ShareVM; fixtures: boolean }) {
  return (
    <Card title={t.plan.shareTitle} headingLevel={2} tone="muted" data-testid="together-share">
      <Stack gap="md">
        <p className="text-sm">{t.plan.shareLead}</p>
        <label className="flex flex-col gap-xs text-sm font-medium">
          {t.plan.linkLabel}
          <input
            readOnly
            value={share.url}
            data-testid="together-link"
            onFocus={(e) => e.currentTarget.select()}
            className="w-full rounded-lg border-2 border-border bg-surface px-md py-sm text-sm"
          />
        </label>
        <div className="flex flex-wrap gap-md">
          <Button onClick={share.copy} data-testid="together-copy">
            {share.copied ? t.plan.copied : t.plan.copy}
          </Button>
          {share.share && (
            <Button variant="secondary" onClick={share.share}>
              {t.plan.share}
            </Button>
          )}
        </div>
        {fixtures && <p className="text-xs text-text-muted">{t.plan.shareFixturesBack}</p>}
      </Stack>
    </Card>
  );
}

export function TogetherPlanScreen({ vm, startHref }: { vm: TogetherPlanVM; startHref: string }) {
  const shell = (children: ReactNode) => (
    <main className="mx-auto flex w-full max-w-(--container-3xl) flex-col gap-xl px-lg py-xl sm:py-3xl">{children}</main>
  );
  if (vm.status === 'loading') return shell(<p role="status">{t.loading}</p>);
  if (vm.status === 'notFound') {
    return shell(
      <>
        <PageHeader eyebrow={t.eyebrow} title={t.title} />
        <p data-testid="together-not-found">{t.plan.notFound}</p>
        <a href={startHref} className={buttonClassName()}>
          {t.plan.startNew}
        </a>
      </>,
    );
  }
  if (vm.status === 'error') {
    return shell(
      <>
        <PageHeader eyebrow={t.eyebrow} title={t.title} />
        <p role="alert" className="text-negative">
          {errorText(vm.error)}
        </p>
        <Button onClick={vm.retry}>{t.plan.retry}</Button>
      </>,
    );
  }

  const p1 = t.label(vm.names.p1, 1);
  const p2 = t.label(vm.names.p2, 2);
  const joining = vm.role === 'partner2' && vm.waiting;
  return shell(
    <>
      <PageHeader
        eyebrow={t.eyebrow}
        title={joining ? t.plan.joinTitle(p1) : t.title}
        intro={joining ? t.plan.joinLead : undefined}
      />
      {vm.role === 'partner1' && <SharePanel share={vm.share} fixtures={vm.storage === 'fixtures'} />}
      {vm.role === 'partner1' && vm.waiting && (
        <div className="flex flex-wrap items-center gap-md" data-testid="together-waiting">
          <p>{t.plan.waiting(p2)}</p>
          {vm.refresh && (
            <Button variant="secondary" size="sm" onClick={vm.refresh}>
              {t.plan.refresh}
            </Button>
          )}
        </div>
      )}
      {vm.form && (
        <Stack gap="lg">
          <PartnerForm vm={vm.form} goalKeepHint />
          {vm.submitError && (
            <p role="alert" className="rounded-lg bg-surface p-lg text-sm font-medium text-negative">
              {errorText(vm.submitError)}
            </p>
          )}
          <div className="flex flex-wrap gap-md">
            <Button size="lg" onClick={vm.submit} disabled={vm.form.problem !== null || vm.submitting} data-testid="together-submit">
              {vm.submitting ? t.plan.submitting : vm.waiting ? t.plan.submit : t.plan.update}
            </Button>
            {vm.cancelEdit && (
              <Button variant="ghost" size="lg" onClick={vm.cancelEdit}>
                {t.plan.cancel}
              </Button>
            )}
          </div>
        </Stack>
      )}
      {vm.result && !vm.form && <ResultView result={vm.result} names={vm.names} />}
      {vm.resultError && <p role="alert">{t.result.error}</p>}
      {vm.editMine && (
        <div>
          <Button variant="secondary" onClick={vm.editMine}>
            {t.plan.edit}
          </Button>
        </div>
      )}
      {vm.role === 'partner2' && !vm.waiting && <SharePanel share={vm.share} fixtures={vm.storage === 'fixtures'} />}
      <p className="text-xs text-text-muted">
        {t.plan.expires(vm.expiresOn)} {t.storage[vm.storage]}
      </p>
    </>,
  );
}
