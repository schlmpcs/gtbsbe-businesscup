// S8 Balance sheet (Design v3, Figma 202:2117): white cards for age and take-home pay, savings and
// debts, each value on a cream row (label left, number right; a skipped field shows an estimate tag,
// a typed one can be skipped back to our estimate). Debts, confirm not type (JF17): payments found in
// the statement come up as a card to confirm; "+ kind" chips open a form where only the balance is
// typed (APR and minimum prefilled, tagged estimate, editable); edit / remove; the debt-load gauge.
// JF4 "Your home": rent / own with a mortgage / own outright; when owning, the home value and HOA on
// cream rows, the appreciation and the monthly owner costs with their estimate tags and sources, and
// "Add your mortgage" (the debt form preset to a mortgage) when none is listed.
// Right: an ink card with today's net worth, then the house being built.
import { useId, useState, type ReactNode } from 'react';
import { ladder } from '@/copy';
import {
  Art, Button, Choice, cx, EstimateTag, formatMoney, formatRate, Gauge, NumberInput, SourceNote, Sticker, type Source,
} from '@/ui-kit';
import type {
  BalanceFieldKey, BalanceSheetVM, DebtInput, DebtRowVM, HomeSectionVM, HomeSummary, LadderProgressVM,
} from '../model/types';
import { DebtForm } from './DebtForm';
import { LadderShell } from './LadderShell';

const t = ladder.balance;

export type BalanceSheetProps = {
  vm: BalanceSheetVM;
  progress: LadderProgressVM;
};

function SheetCard({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-md rounded-xl bg-surface p-xl shadow-md">
      <h2 id={id} className="text-lg font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function BalanceSheet({ vm, progress }: BalanceSheetProps) {
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
          <Art name="house-build" className="mx-auto hidden w-full max-w-(--container-md) lg:block" />
        </>
      }
    >
      <SheetCard title={t.payTitle}>
        <BalanceField field="age" vm={vm} />
        <BalanceField field="takeHomePay" vm={vm} />
      </SheetCard>

      <SheetCard title={t.savingsTitle}>
        <BalanceField field="cash" vm={vm} />
        <BalanceField field="retirement" vm={vm} />
      </SheetCard>

      <SheetCard title={t.home.title}>
        <HomeSection
          vm={vm}
          home={vm.home}
          addingMortgage={editing === 'home:mortgage'}
          onAddMortgage={() => setEditing('home:mortgage')}
          onDoneMortgage={() => setEditing(null)}
        />
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
  const hint = isEstimate ? t.estimatedHint : isAge ? undefined : t.hints[field];
  return (
    <div
      data-field={field}
      data-estimate={isEstimate ? 'true' : 'false'}
      className="flex flex-wrap items-center justify-between gap-md rounded-lg bg-bg px-lg py-md"
    >
      <div className="flex min-w-0 flex-col gap-xs">
        <span className="flex flex-wrap items-center gap-sm">
          <label htmlFor={inputId} className="text-base text-text-muted">
            {t.fields[field]}
          </label>
          {isEstimate && <EstimateTag className="bg-surface" />}
        </span>
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

const h = t.home;

/** The value and estimate tag / source of one number, as a cream row (label left, value right). */
function HomeInputRow({
  label,
  hint,
  isEstimate,
  source,
  value,
  bounds,
  suffix,
  onChange,
  field,
}: {
  label: string;
  hint: string;
  isEstimate: boolean;
  source: Source | null;
  value: number;
  bounds: { min: number; max: number };
  suffix?: string;
  onChange: (v: number) => void;
  field: string;
}) {
  const inputId = useId();
  const hintId = useId();
  return (
    <div
      data-field={field}
      data-estimate={isEstimate ? 'true' : 'false'}
      className="flex flex-wrap items-center justify-between gap-md rounded-lg bg-bg px-lg py-md"
    >
      <div className="flex min-w-0 flex-col gap-xs">
        <span className="flex flex-wrap items-center gap-sm">
          <label htmlFor={inputId} className="text-base text-text-muted">
            {label}
          </label>
          {isEstimate && <EstimateTag className="bg-surface" />}
        </span>
        <span id={hintId} className="text-xs text-text-muted">
          {hint}
        </span>
        {source && <SourceNote source={source} variant="toggle" />}
      </div>
      <NumberInput
        id={inputId}
        aria-describedby={hintId}
        value={value}
        min={bounds.min}
        max={bounds.max}
        maxFractionDigits={0}
        prefix="$"
        suffix={suffix}
        onValueChange={(v) => {
          if (v !== null) onChange(v);
        }}
        className={cx(
          'min-w-0 flex-1 font-display sm:w-(--container-3xs) sm:flex-none text-2xl font-extrabold [&_input]:py-xs [&_input]:text-right [&_input]:text-2xl',
          isEstimate && '[&_input]:text-text-muted',
        )}
      />
    </div>
  );
}

/** The monthly owner costs (engine ownerCosts), one line each with its tag and source, and the total. */
function OwnerCosts({ costs }: { costs: HomeSummary['costs'] }) {
  return (
    <section aria-label={h.costsTitle} data-testid="owner-costs" className="flex flex-col gap-sm rounded-lg bg-bg px-lg py-md">
      <h3 className="text-base font-semibold">{h.costsTitle}</h3>
      <ul className="flex flex-col gap-xs">
        {costs.lines.map((l) => (
          <li key={l.key} data-cost={l.key} className="flex flex-wrap items-start justify-between gap-sm text-sm">
            <span className="flex min-w-0 flex-col gap-xs">
              <span className="flex flex-wrap items-center gap-sm text-text-muted">
                {h.costLines[l.key]}
                {l.isEstimate && <EstimateTag className="bg-surface" />}
              </span>
              {l.source && <SourceNote source={l.source} variant="toggle" />}
            </span>
            <span className="font-semibold tabular-nums">{h.perMonth(formatMoney(l.monthly))}</span>
          </li>
        ))}
      </ul>
      <p className="flex flex-wrap items-baseline justify-between gap-sm border-t-2 border-border pt-sm">
        <span className="flex items-center gap-sm font-bold">
          {h.costsTotal}
          {costs.isEstimate && <EstimateTag className="bg-surface" />}
        </span>
        <span className="font-display text-2xl font-extrabold tabular-nums" data-testid="owner-costs-total">
          {h.perMonth(formatMoney(costs.total))}
        </span>
      </p>
      <p className="text-xs text-text-muted">{h.costsNote}</p>
    </section>
  );
}

/** JF4 "Your home": rent or own; when owning, the home's numbers and its monthly costs. */
function HomeSection({
  vm,
  home,
  addingMortgage,
  onAddMortgage,
  onDoneMortgage,
}: {
  vm: BalanceSheetVM;
  home: HomeSectionVM;
  addingMortgage: boolean;
  onAddMortgage: () => void;
  onDoneMortgage: () => void;
}) {
  const s = home.summary;
  return (
    <div className="flex flex-col gap-md" data-testid="home-section" data-tenure={home.tenure}>
      <Choice
        legend={h.tenureLegend}
        name="home-tenure"
        value={home.tenure}
        options={home.tenures.map((k) => ({ value: k, label: h.tenures[k] }))}
        onChange={home.setTenure}
      />
      {!s ? (
        <p className="text-sm text-text-muted">{h.rentNote}</p>
      ) : (
        <>
          <HomeInputRow
            field="homeValue"
            label={h.value}
            hint={s.value.isEstimate ? h.valueEstimated : h.valueHint}
            isEstimate={s.value.isEstimate}
            source={s.value.source}
            value={s.value.value}
            bounds={home.bounds.value}
            onChange={home.setValue}
          />
          <HomeInputRow
            field="hoaMonthly"
            label={h.hoa}
            hint={h.hoaHint}
            isEstimate={false}
            source={null}
            value={s.hoaMonthly}
            bounds={home.bounds.hoaMonthly}
            suffix={t.perMonthSuffix}
            onChange={home.setHoaMonthly}
          />
          <div className="flex flex-col gap-xs px-lg text-sm text-text-muted" data-testid="home-appreciation">
            <span className="flex flex-wrap items-center gap-sm">
              {h.appreciation(formatRate(s.appreciation.value, 1))}
              {s.appreciation.isEstimate && <EstimateTag className="bg-surface" />}
            </span>
            {s.appreciation.source && <SourceNote source={s.appreciation.source} variant="toggle" />}
          </div>
          <OwnerCosts costs={s.costs} />
          {home.mortgageWhileOutright && <p className="text-sm text-text-muted">{h.mortgageWhileOutright}</p>}
          {home.needsMortgage &&
            (addingMortgage ? (
              <DebtForm
                title={h.addMortgage}
                kinds={['mortgage']}
                bounds={vm.debtBounds}
                aprDefaults={vm.debtAprDefaults}
                estimateMinPayment={vm.estimateMinPayment}
                initial={{ kind: 'mortgage', balance: null, apr: null, minPayment: null }}
                onSave={(input) => {
                  vm.addDebt(input);
                  onDoneMortgage();
                }}
                onCancel={onDoneMortgage}
              />
            ) : (
              <div className="flex flex-col items-start gap-xs">
                <Button variant="dark" size="sm" onClick={onAddMortgage}>
                  <span aria-hidden="true">+</span>
                  {h.addMortgage}
                </Button>
                <p className="text-xs text-text-muted">{h.addMortgageNote}</p>
              </div>
            ))}
        </>
      )}
    </div>
  );
}
