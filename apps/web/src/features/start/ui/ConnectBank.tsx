'use client';
import { start as t } from '@/copy';
import { TextShimmer } from '@/ui-kit/arc';
import { Button, cx, Photo } from '@/ui-kit';
import type { BankVM, ConnectVM } from '../model/types';
import { ArrowIcon, BackIcon, CheckIcon, LockIcon } from './icons';

function BankMark({ bank, size = 'md' }: { bank: BankVM; size?: 'md' | 'lg' }) {
  return (
    <span
      className={cx('grid shrink-0 place-items-center border border-border bg-surface', size === 'lg' ? 'size-14 rounded-lg p-sm' : 'size-11 rounded-md p-[7px]')}
      aria-hidden="true"
    >
      <Photo src={bank.logo} alt="" className="object-contain" priority />
    </span>
  );
}

/** The simulated bank connection, in a centered panel like an aggregator's: pick → share → linking. */
export function ConnectBank({ vm }: { vm: ConnectVM }) {
  return (
    <div className="mx-auto flex w-full max-w-(--container-md) flex-col gap-lg">
      {vm.stage !== 'linking' ? (
        <button type="button" onClick={vm.back} className="inline-flex w-fit items-center gap-xs text-sm font-semibold text-text-muted hover:text-text">
          <BackIcon />{t.connect.back}
        </button>
      ) : null}

      <div className="flex flex-col gap-lg rounded-2xl border border-border bg-surface p-xl shadow-[0_30px_80px_rgb(29_27_24/0.12)]">
        {vm.stage === 'pick' ? (
          <>
            <div className="flex flex-col gap-xs">
              <h1 className="text-2xl leading-tight">{t.connect.pickTitle}</h1>
              <p className="text-sm text-text-muted">{t.connect.pickLead}</p>
            </div>
            <ul className="grid grid-cols-2 gap-sm">
              {vm.banks.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => vm.pick(b.id)}
                    data-testid={`bank-${b.id}`}
                    className="flex w-full items-center gap-sm rounded-lg border border-border p-sm text-left transition hover:border-ink hover:shadow-[0_6px_16px_rgb(29_27_24/0.08)]"
                  >
                    <BankMark bank={b} />
                    <span className="min-w-0 text-sm font-semibold leading-tight">{b.name}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="rounded-lg bg-surface-strong p-md text-xs text-text-muted">{t.connect.demoNote}</p>
          </>
        ) : null}

        {vm.stage === 'accounts' && vm.bank && vm.account ? (
          <>
            <div className="flex items-center gap-md">
              <BankMark bank={vm.bank} size="lg" />
              <div className="flex flex-col">
                <h1 className="text-2xl leading-tight">{t.connect.accountsTitle(vm.bank.name)}</h1>
                <p className="text-sm text-text-muted">{t.connect.accountsLead}</p>
              </div>
            </div>
            <div className="flex items-center gap-md rounded-lg border-2 border-ink p-md">
              <span className="grid size-6 shrink-0 place-items-center rounded-md bg-ink text-on-primary"><CheckIcon /></span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-bold">{vm.account.label} ••{vm.account.last4}</span>
                <span className="text-xs text-text-muted">{t.connect.holder(vm.account.metro)}</span>
                <span className="text-xs font-semibold text-positive">{t.connect.readOnly}</span>
              </span>
            </div>
            <ul className="flex flex-col gap-xs text-sm">
              <li className="flex items-start gap-sm"><CheckIcon className="mt-[3px] shrink-0 text-positive" />{t.connect.weSee}</li>
              <li className="flex items-start gap-sm"><LockIcon className="mt-[3px] shrink-0 text-text-muted" />{t.connect.weNever}</li>
            </ul>
            <Button size="lg" fullWidth onClick={vm.confirm} data-testid="connect-share">
              {t.connect.share}<ArrowIcon />
            </Button>
            <p className="text-xs text-text-muted">{t.connect.demoNote}</p>
          </>
        ) : null}

        {vm.stage === 'linking' && vm.bank ? (
          <div className="flex flex-col items-center gap-lg py-xl text-center" aria-live="polite">
            <div className="flex items-center gap-md">
              <BankMark bank={vm.bank} size="lg" />
              <span className="flex gap-xs" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="size-2 rounded-full bg-ink opacity-0 [animation:fadeUp_.6s_ease_infinite_alternate]" style={{ animationDelay: `${i * 180}ms` }} />
                ))}
              </span>
              <span className="grid size-14 place-items-center overflow-hidden rounded-lg"><Photo src="/icon.svg" alt="" className="object-contain" priority /></span>
            </div>
            <TextShimmer as="p" className="text-lg font-bold">{t.connect.linking(vm.bank.name)}</TextShimmer>
            <ul className="flex flex-col gap-xs text-sm text-text-muted">
              {t.connect.linkingSteps.map((s) => <li key={s}>{s}</li>)}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
