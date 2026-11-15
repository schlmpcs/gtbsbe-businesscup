'use client';

// The demo bank link, in a sheet: pick a test bank → sign in with demo credentials → connecting →
// connected (the accounts its statement shows) → "Use these transactions". It is a DEMO and says so on
// every step (badge + one line). Presentational: everything comes from useBankDemo; the route renders
// it next to the screen that opens it (/start chapter 3, /accounts, /transactions).
import type { CSSProperties } from 'react';
import { bankDemo as t } from '@/copy';
import { Button, cx, Sheet, Tag } from '@/ui-kit';
import type { BankDemoVM, ConnectStepVM, DemoAccountVM, DemoBankTone, DemoBankVM } from '../model/types';

const TONE: Record<DemoBankTone, string> = {
  1: 'bg-chart-1',
  2: 'bg-chart-2',
  3: 'bg-chart-3',
  4: 'bg-chart-4',
  5: 'bg-chart-5',
};

const INPUT = 'w-full min-h-11 rounded-lg border-2 border-border bg-surface px-md py-sm text-base';

export type BankDemoSheetProps = { vm: BankDemoVM };

/** "Demo · sample data": on the entry cards and on every step of the sheet. */
export function DemoBadge({ className }: { className?: string }) {
  return (
    <Tag className={cx('border-primary font-bold text-primary', className)} data-testid="bank-demo-badge">
      {t.badge}
    </Tag>
  );
}

export function BankDemoSheet({ vm }: BankDemoSheetProps) {
  const title =
    vm.step === 'signin' && vm.bank
      ? t.signIn.title(vm.bank.name)
      : vm.step === 'connecting'
        ? t.connecting.title
        : vm.step === 'connected'
          ? t.connected.title
          : vm.step === 'error'
            ? t.error.title
            : t.pick.title;
  return (
    <Sheet
      open={vm.open}
      onClose={vm.close}
      title={title}
      description={
        <span className="flex flex-col gap-xs">
          <DemoBadge />
          <span>{t.disclaimer}</span>
        </span>
      }
      footer={<Footer vm={vm} />}
    >
      <div key={vm.step} className="ob-enter" data-testid="bank-demo" data-step={vm.step}>
        {vm.step === 'pick' && <Pick vm={vm} />}
        {vm.step === 'signin' && vm.bank && <SignIn vm={vm} bank={vm.bank} />}
        {vm.step === 'connecting' && <Connecting steps={vm.steps} days={vm.days} />}
        {vm.step === 'connected' && vm.bank && <Connected bank={vm.bank} accounts={vm.accounts} />}
        {vm.step === 'error' && (
          <p role="alert" className="text-base text-negative">
            {t.error.title}
          </p>
        )}
      </div>
    </Sheet>
  );
}

function Footer({ vm }: { vm: BankDemoVM }) {
  const back =
    vm.step !== 'pick' ? (
      <Button variant="ghost" onClick={vm.back}>
        {t.back}
      </Button>
    ) : (
      <span />
    );
  const main =
    vm.step === 'signin' ? (
      <Button type="submit" form="bank-demo-signin" data-testid="bank-demo-connect">
        {t.signIn.submit}
      </Button>
    ) : vm.step === 'connected' ? (
      <Button onClick={vm.use} data-testid="bank-demo-use" className="ob-press">
        {t.connected.use}
      </Button>
    ) : vm.step === 'error' ? (
      <Button onClick={vm.retry}>{t.error.retry}</Button>
    ) : null;
  return (
    <div className="flex items-center justify-between gap-sm">
      {back}
      {main}
    </div>
  );
}

function BankTile({ bank, size = 'md' }: { bank: DemoBankVM; size?: 'md' | 'lg' }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full font-display font-extrabold text-on-primary',
        TONE[bank.tone],
        size === 'lg' ? 'size-14 text-xl' : 'size-10 text-sm',
      )}
    >
      {bank.initials}
    </span>
  );
}

function Pick({ vm }: { vm: BankDemoVM }) {
  return (
    <div className="flex flex-col gap-md">
      <input
        type="search"
        value={vm.query}
        onChange={(e) => vm.search(e.target.value)}
        aria-label={t.pick.searchLabel}
        placeholder={t.pick.searchPlaceholder}
        autoComplete="off"
        className={INPUT}
        data-testid="bank-demo-search"
      />
      {vm.banks.length === 0 ? (
        <p className="py-lg text-center text-text-muted">{t.pick.none}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-sm min-[400px]:grid-cols-2">
          {vm.banks.map((b, i) => (
            <li key={b.id} className="ob-enter" style={{ '--ob-delay': `${i * 40}ms` } as CSSProperties}>
              <button
                type="button"
                onClick={() => vm.pick(b.id)}
                data-testid={`bank-demo-bank-${b.id}`}
                className="ob-press flex min-h-14 w-full items-center gap-md rounded-lg border-2 border-border bg-surface p-md text-left font-semibold hover:border-text"
              >
                <BankTile bank={b} />
                <span className="min-w-0">{b.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SignIn({ vm, bank }: { vm: BankDemoVM; bank: DemoBankVM }) {
  return (
    <form
      id="bank-demo-signin"
      onSubmit={(e) => {
        e.preventDefault();
        vm.connect();
      }}
      className="flex flex-col gap-lg"
    >
      <div className="flex items-center gap-md">
        <BankTile bank={bank} size="lg" />
        <span className="font-display text-xl font-extrabold leading-tight">{bank.name}</span>
      </div>
      {/* Read-only demo values: there is no real sign-in, and nothing typed here would go anywhere. */}
      <label className="flex flex-col gap-xs text-sm font-semibold">
        {t.signIn.user}
        <input readOnly value="demo" autoComplete="off" className={cx(INPUT, 'text-text-muted')} />
      </label>
      <label className="flex flex-col gap-xs text-sm font-semibold">
        {t.signIn.password}
        <input readOnly type="password" value="demo" autoComplete="off" className={cx(INPUT, 'text-text-muted')} />
      </label>
      <p className="rounded-lg bg-primary-soft p-md text-sm font-semibold" data-testid="bank-demo-credentials-note">
        {t.signIn.note}
      </p>
    </form>
  );
}

function StepIcon({ status }: { status: ConnectStepVM['status'] }) {
  if (status === 'done') {
    return (
      <span aria-hidden="true" className="ob-pop inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-positive text-on-primary">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor">
          <path d="M5 12.5l4.5 4.5L19 7.5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (status === 'active') {
    return <span aria-hidden="true" className="size-7 shrink-0 animate-spin rounded-full border-4 border-primary-soft border-t-primary" />;
  }
  return <span aria-hidden="true" className="size-7 shrink-0 rounded-full border-2 border-border" />;
}

function Connecting({ steps, days }: { steps: ConnectStepVM[]; days: number | null }) {
  const done = steps.filter((s) => s.status === 'done').length;
  const label = (s: ConnectStepVM) => (s.id === 'transactions' ? t.connecting.steps.transactions(days) : t.connecting.steps[s.id]);
  const state = { done: t.connecting.done, active: t.connecting.working, todo: t.connecting.waiting } as const;
  return (
    <div className="flex flex-col gap-lg" role="status" aria-live="polite">
      <span className="block h-2 w-full overflow-hidden rounded-full bg-surface-strong" aria-hidden="true">
        <span className="block h-full rounded-full bg-primary transition-[width] duration-500 ease-out" style={{ width: `${(done / steps.length) * 100}%` }} />
      </span>
      <ol className="flex flex-col gap-md">
        {steps.map((s) => (
          <li key={s.id} className="flex items-center gap-md" data-testid={`bank-demo-step-${s.id}`} data-status={s.status}>
            <StepIcon status={s.status} />
            <span className={cx('text-base', s.status === 'todo' ? 'text-text-muted' : 'font-semibold')}>{label(s)}</span>
            <span className="sr-only">{state[s.status]}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Connected({ bank, accounts }: { bank: DemoBankVM; accounts: DemoAccountVM[] }) {
  return (
    <div className="flex flex-col gap-lg">
      <div className="flex items-center gap-md">
        <BankTile bank={bank} size="lg" />
        <p className="text-base">{t.connected.intro(bank.name)}</p>
      </div>
      <ul className="flex flex-col gap-sm" data-testid="bank-demo-accounts">
        {accounts.map((a, i) => (
          <li
            key={a.kind}
            className="ob-pop flex items-center justify-between gap-md rounded-lg border-2 border-border bg-surface p-md"
            style={{ '--ob-delay': `${i * 120}ms` } as CSSProperties}
            data-testid={`bank-demo-account-${a.kind}`}
          >
            <span className="font-semibold">{a.kind === 'checking' ? t.connected.checking : t.connected.card}</span>
            <span className="text-right text-sm text-text-muted tabular-nums">
              {a.kind === 'checking' ? t.connected.checkingNote(a.transactions, a.days) : t.connected.cardNote(a.payments)}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-text-muted">{t.connected.privacy}</p>
    </div>
  );
}
