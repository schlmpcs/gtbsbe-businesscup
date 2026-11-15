'use client';

// /together/<id>: the shared plan. Partner 1 waiting: step 2 (send the link, with copy feedback).
// Partner 2 joining: step 3 (their numbers). Both in: the household view. All data and actions come
// from useTogetherPlan(id).
import type { ReactNode } from 'react';
import { together as t } from '@/copy';
import { Button, Card, PageHeader, Stack, buttonClassName, cx } from '@/ui-kit';
import type { ShareVM, TogetherPlanVM } from '../model/types';
import { PartnerForm } from './PartnerForm';
import { ResultView } from './ResultView';
import { Steps } from './Steps';
import { errorText } from './TogetherStartScreen';

function SharePanel({ share, fixtures, prominent }: { share: ShareVM; fixtures: boolean; prominent: boolean }) {
  return (
    <Card
      title={t.plan.shareTitle}
      headingLevel={2}
      tone={prominent ? 'default' : 'muted'}
      data-testid="together-share"
      className={cx(prominent && 'animate-enter border-2 border-primary')}
    >
      <Stack gap="md">
        <p className="text-sm">{t.plan.shareLead}</p>
        <label className="flex flex-col gap-xs text-sm font-medium">
          {t.plan.linkLabel}
          <input
            readOnly
            value={share.url}
            data-testid="together-link"
            onFocus={(e) => e.currentTarget.select()}
            className="min-h-11 w-full rounded-lg border-2 border-border bg-bg px-md py-sm text-sm"
          />
        </label>
        <div className="flex flex-wrap gap-md">
          <Button
            onClick={share.copy}
            data-testid="together-copy"
            variant={share.copied ? 'secondary' : 'primary'}
            className="min-w-36"
          >
            {share.copied ? t.plan.copied : t.plan.copy}
          </Button>
          {share.share && (
            <Button variant="secondary" onClick={share.share}>
              {t.plan.share}
            </Button>
          )}
        </div>
        <p aria-live="polite" className="text-sm empty:hidden" data-testid="together-copy-status">
          {share.copied ? t.plan.copiedLive : share.copyFailed ? t.plan.copyFailed : ''}
        </p>
        {fixtures && <p className="text-xs text-text-muted">{t.plan.shareFixturesBack}</p>}
      </Stack>
    </Card>
  );
}

function Waiting({ name, refresh }: { name: string; refresh: (() => void) | null }) {
  return (
    <Card tone="muted" data-testid="together-waiting-card">
      <Stack gap="md">
        <div className="flex flex-wrap items-center gap-md" data-testid="together-waiting">
          <span aria-hidden="true" className="relative flex size-3">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex size-3 rounded-full bg-primary" />
          </span>
          <p className="font-semibold">{t.plan.waiting(name)}</p>
          {refresh && (
            <Button variant="secondary" size="sm" onClick={refresh}>
              {t.plan.refresh}
            </Button>
          )}
        </div>
        <div>
          <h2 className="mb-xs text-base font-bold">{t.plan.nextTitle}</h2>
          <ol className="flex list-decimal flex-col gap-xs pl-lg text-sm text-text-muted">
            {t.plan.next.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        </div>
      </Stack>
    </Card>
  );
}

export function TogetherPlanScreen({ vm, startHref }: { vm: TogetherPlanVM; startHref: string }) {
  const shell = (children: ReactNode) => (
    <main className="mx-auto flex w-full max-w-(--container-3xl) flex-col gap-xl px-lg pb-2xl pt-md sm:pt-xl">{children}</main>
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
  const step = vm.waiting ? (vm.role === 'partner1' ? 2 : 3) : 4;
  return shell(
    <>
      <PageHeader
        eyebrow={t.eyebrow}
        title={joining ? t.plan.joinTitle(p1) : t.title}
        intro={joining ? t.plan.joinLead : undefined}
        className="animate-enter"
      />
      {vm.waiting && <Steps current={step} />}
      {vm.role === 'partner1' && vm.waiting && (
        <>
          <SharePanel share={vm.share} fixtures={vm.storage === 'fixtures'} prominent />
          <Waiting name={p2} refresh={vm.refresh} />
        </>
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
            <Button size="lg" onClick={vm.submit} disabled={vm.form.problem !== null || vm.submitting} data-testid="together-submit" className="max-sm:w-full">
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
      {vm.result && !vm.form && (
        <ResultView result={vm.result} names={vm.names} splitMode={vm.splitMode} onSplitMode={vm.setSplitMode} />
      )}
      {vm.resultError && <p role="alert">{t.result.error}</p>}
      {vm.editMine && (
        <div>
          <Button variant="secondary" onClick={vm.editMine}>
            {t.plan.edit}
          </Button>
        </div>
      )}
      {!vm.waiting && !vm.form && <SharePanel share={vm.share} fixtures={vm.storage === 'fixtures'} prominent={false} />}
      <p className="text-xs text-text-muted">
        {t.plan.expires(vm.expiresOn)} {t.storage[vm.storage]}
      </p>
    </>,
  );
}
