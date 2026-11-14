// S8 Balance sheet (Design v3, Figma 202:2117): savings and debts only. Age and take-home pay are asked
// once, on About you (S6): here one read-only line shows them, with a link back. Savings is a white card
// with each value on a cream row (label left, number right; a skipped value is grey, with one estimate
// tag for the card rather than one per row; a typed one can be skipped back to our estimate). Debts,
// confirm not type (JF17): payments found in the statement come up as a card to confirm; "+ kind" chips
// open a form where only the balance is typed (APR and minimum prefilled, tagged estimate, editable);
// edit / remove; the debt-load gauge. Right: an ink card with today's net worth, the S5 guess against
// the month, then the house being built.
import { useId, useState, type ReactNode } from 'react';
import { ladder } from '@/copy';
import { Art, Button, Choice, cx, EstimateTag, formatMoney, formatRate, Gauge, NumberInput, Sticker } from '@/ui-kit';
import type { BalanceFieldKey, BalanceSheetVM, DebtInput, DebtRowVM, GuessPayoffVM, LadderProgressVM } from '../model/types';
import { DebtForm } from './DebtForm';
import { GuessPayoff } from './GuessPayoff';
import { LadderShell } from './LadderShell';

const t = ladder.balance;

export type BalanceSheetProps = {
  vm: BalanceSheetVM;
  progress: LadderProgressVM;
  /** The S5 guess against the month (its own hook); null without a guess. */
  payoff?: GuessPayoffVM | null;
};

function SheetCard({ title, estimate = false, children }: { title: string; estimate?: boolean; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-md rounded-xl bg-surface p-xl shadow-md">
      <h2 id={id} className="text-lg font-bold">
        {title}
      </h2>
      {/* One estimate tag for the card (its sr-only text explains it once), not one per row. */}
      {estimate && (
        <p className="flex flex-wrap items-center gap-sm text-sm text-text-muted" data-testid="sheet-estimates">
          <EstimateTag className="bg-surface" />
          {t.estimatedNote}
        </p>
      )}
      {children}
    </section>
  );
}

/** Age and pay, asked on About you: shown here read-only, with the way back to change them. */
function FromAbout({ vm, href }: { vm: BalanceSheetVM; href: string | undefined }) {
  const { age, takeHomePay } = vm.fields;
  return (
    <section
      aria-label={t.fromAboutLabel}
      data-testid="from-about"
      className="flex flex-wrap items-center justify-between gap-sm rounded-xl bg-surface px-xl py-md text-sm shadow-md"
    >
      <span className="flex flex-wrap items-center gap-sm text-text-muted tabular-nums">
        {t.fromAbout(String(age.value), formatMoney(takeHomePay.value))}
        {(age.isEstimate || takeHomePay.isEstimate) && <EstimateTag className="bg-surface" />}
      </span>
      {href && (
        <a href={href} className="min-h-11 content-center font-semibold text-text hover:text-primary">
          {t.fromAboutLink}
        </a>
      )}
    </section>
  );
}

export function BalanceSheet({ vm, progress, payoff = null }: BalanceSheetProps) {
  // Which debt row is being edited, or 'new:<kind>' for the quick add form.
  const [editing, setEditing] = useState<string | null>(null);
  const newKind = vm.debtKinds.find((k) => editing === `new:${k}`);

  return (
    <LadderShell
      screen="S8"
      progress={progress}
      loading={vm.status === 'loading'}
      aside={
        <>
          <section aria-label={t.netWorthScore} className="flex flex-col gap-sm rounded-xl bg-ink p-xl text-on-primary shadow-md">
            <p className="text-xs font-bold uppercase tracking-wide text-primary">{t.netWorthScore}</p>
            <p className="font-display text-[length:calc(var(--text-display)*1.2)] font-extrabold leading-display tracking-tight tabular-nums">
              {formatMoney(vm.netWorth)}
            </p>
            <p className="text-sm text-on-primary/60">{t.netWorthNote}</p>
          </section>
          {payoff && <GuessPayoff payoff={payoff} />}
          <Art name="house-build" className="mx-auto hidden w-full max-w-(--container-md) lg:block" />
        </>
      }
    >
      <FromAbout vm={vm} href={progress.rungs.find((r) => r.screen === 'S6')?.href} />

      <SheetCard title={t.savingsTitle} estimate={vm.fields.cash.isEstimate || vm.fields.retirement.isEstimate}>
        <BalanceField field="cash" vm={vm} />
        <BalanceField field="retirement" vm={vm} />
      </SheetCard>

      <SheetCard title={t.debtsTitle}>
        <div className="grid gap-xl md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="flex flex-col gap-sm">
            {vm.debts.length === 0 && !newKind && !vm.detectedDebt && <p className="text-sm text-text-muted">{t.noDebts}</p>}
            {vm.debts.length > 0 && (
              <ul aria-label={t.debtsLabel} className="flex flex-col gap-sm">
                {vm.debts.map((d) => (
                  <li key={d.id}>
                    {editing === d.id ? (
                      <DebtForm
                        title={t.formTitleEdit(t.debtKinds[d.kind])}
                        kinds={vm.debtKinds}
                        bounds={vm.debtBounds}
                        aprDefaults={vm.debtAprDefaults}
                        estimateMinPayment={vm.estimateMinPayment}
                        initial={{
                          kind: d.kind,
                          balance: d.balance,
                          apr: d.apr,
                          // A skipped minimum stays skipped unless the user types one.
                          minPayment: d.minPaymentIsEstimate ? null : d.minPayment,
                        }}
                        onSave={(input) => {
                          vm.updateDebt(d.id, input);
                          setEditing(null);
                        }}
                        onCancel={() => setEditing(null)}
                      />
                    ) : (
                      <DebtRow
                        debt={d}
                        onEdit={() => setEditing(d.id)}
                        onRemove={() => {
                          vm.removeDebt(d.id);
                          if (editing === d.id) setEditing(null);
                        }}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
            {vm.detectedDebt && editing === null && <DetectedDebt vm={vm} detected={vm.detectedDebt} />}
            {newKind ? (
              <DebtForm
                key={newKind}
                title={t.formTitleAdd}
                kinds={vm.debtKinds}
                bounds={vm.debtBounds}
                aprDefaults={vm.debtAprDefaults}
                estimateMinPayment={vm.estimateMinPayment}
                initial={{ kind: newKind, balance: null, apr: null, minPayment: null }}
                onSave={(input) => {
                  vm.addDebt(input);
                  setEditing(null);
                }}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <div role="group" aria-label={t.addDebt} className="flex flex-wrap gap-sm">
                {vm.debtKinds.map((k) => (
                  <Button
                    key={k}
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditing(`new:${k}`)}
                    aria-label={t.addKindLabel(t.debtKinds[k])}
                    className="rounded-full border-2 border-border"
                  >
                    <span aria-hidden="true">+</span>
                    {t.debtKinds[k]}
                  </Button>
                ))}
              </div>
            )}
          </div>
          <Gauge
            label={t.debtLoadLabel}
            value={vm.debtLoad.value}
            thresholds={vm.debtLoad.thresholds}
            max={vm.debtLoadMax}
            formatValue={(v) => formatRate(v, 0)}
            zoneLabels={t.debtLoadZones}
            hint={t.debtLoadHint}
          />
        </div>
      </SheetCard>
    </LadderShell>
  );
}

function BalanceField({ field, vm }: { field: BalanceFieldKey; vm: BalanceSheetVM }) {
  const { value, isEstimate } = vm.fields[field];
  const bounds = vm.fieldBounds[field];
  const isAge = field === 'age';
  const inputId = useId();
  const hintId = useId();
  // A typical value is grey; the card's one tag explains it (no tag or hint per row).
  const hint = isAge ? undefined : t.hints[field];
  return (
    <div
      data-field={field}
      data-estimate={isEstimate ? 'true' : 'false'}
      className="flex flex-wrap items-center justify-between gap-md rounded-lg bg-bg px-lg py-md"
    >
      <div className="flex min-w-0 flex-col gap-xs">
        <label htmlFor={inputId} className="text-base text-text-muted">
          {t.fields[field]}
        </label>
        {hint && (
          <span id={hintId} className="text-xs text-text-muted">
            {hint}
          </span>
        )}
      </div>
      <div className="flex w-full items-center gap-sm sm:w-auto">
        {!isEstimate && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => vm.skipField(field)}
            aria-label={t.skipLabel(t.fields[field])}
          >
            {t.skip}
          </Button>
        )}
        <NumberInput
          id={inputId}
          aria-describedby={hint ? hintId : undefined}
          value={value}
          min={bounds.min}
          max={bounds.max}
          maxFractionDigits={isAge ? 0 : 2}
          prefix={isAge ? undefined : '$'}
          suffix={isAge ? t.yearsSuffix : field === 'takeHomePay' ? t.perMonthSuffix : undefined}
          onValueChange={(v) => {
            if (v !== null) vm.setField(field, v);
          }}
          className={cx(
            'min-w-0 flex-1 font-display sm:w-(--container-3xs) sm:flex-none text-2xl font-extrabold [&_input]:py-xs [&_input]:text-right [&_input]:text-2xl',
            isEstimate && '[&_input]:text-text-muted',
          )}
        />
      </div>
    </div>
  );
}

function DebtRow({ debt, onEdit, onRemove }: { debt: DebtRowVM; onEdit: () => void; onRemove: () => void }) {
  const kind = t.debtKinds[debt.kind];
  return (
    <div data-debt-id={debt.id} className="flex flex-col gap-xs rounded-lg bg-bg px-lg py-md">
      <div className="flex flex-wrap items-baseline justify-between gap-md">
        <span className="text-base text-text-muted tabular-nums">
          {kind} · {formatRate(debt.apr, 2)} {t.aprLabel}
        </span>
        <span className="font-display text-2xl font-extrabold tabular-nums">{formatMoney(debt.balance)}</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-sm">
        <span className="flex flex-wrap items-center gap-sm text-xs text-text-muted tabular-nums">
          {t.minPaymentPerMonth(formatMoney(debt.minPayment))}
          {debt.minPaymentIsEstimate && <EstimateTag className="bg-surface" />}
        </span>
        <span className="flex gap-xs">
          <Button size="sm" variant="ghost" onClick={onEdit} aria-label={t.editLabel(kind)}>
            {t.edit}
          </Button>
          <Button size="sm" variant="ghost" onClick={onRemove} aria-label={t.removeLabel(kind)}>
            {t.remove}
          </Button>
        </span>
      </div>
    </div>
  );
}

/** JF17: debt payments seen in the statement, as a card to confirm (pick a kind, type the balance) or dismiss. */
function DetectedDebt({
  vm,
  detected,
}: {
  vm: BalanceSheetVM;
  detected: NonNullable<BalanceSheetVM['detectedDebt']>;
}) {
  const d = t.detected;
  const [kind, setKind] = useState<DebtInput['kind']>(vm.debtKinds[0]!);
  const [balance, setBalance] = useState<number | null>(null);
  const inputId = useId();
  return (
    <section aria-label={d.label} className="relative flex flex-col gap-md rounded-lg bg-bg p-lg pt-2xl ring-2 ring-primary ring-inset">
      <Sticker tilt={-4} className="absolute -top-sm left-lg text-xs">
        {d.sticker}
      </Sticker>
      <p className="text-lg font-bold">{d.text(formatMoney(detected.monthlyPayment), detected.months)}</p>
      <Choice
        legend={t.kindLabel}
        name="detected-debt-kind"
        value={kind}
        options={vm.debtKinds.map((k) => ({ value: k, label: t.debtKinds[k] }))}
        onChange={setKind}
      />
      <div className="flex flex-col gap-xs">
        <label htmlFor={inputId} className="text-sm text-text-muted">
          {d.balanceLabel}
        </label>
        <NumberInput
          id={inputId}
          value={balance}
          min={vm.debtBounds.balance.min}
          max={vm.debtBounds.balance.max}
          prefix="$"
          onValueChange={setBalance}
          className="font-display text-2xl font-extrabold [&_input]:text-2xl"
        />
        <p className="flex flex-wrap items-center gap-sm text-xs text-text-muted">
          <EstimateTag className="bg-surface" />
          {t.aprLabel} {formatRate(vm.debtAprDefaults[kind], 2)} · {d.note}
        </p>
      </div>
      <div className="flex flex-wrap gap-sm">
        <Button
          variant="dark"
          disabled={balance === null}
          onClick={() => {
            if (balance !== null) vm.confirmDetected(kind, balance);
          }}
        >
          {d.confirm}
        </Button>
        <Button variant="ghost" onClick={vm.dismissDetected}>
          {d.dismiss}
        </Button>
      </div>
    </section>
  );
}
