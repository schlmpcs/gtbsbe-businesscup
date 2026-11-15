// S8 Balance sheet in six taps: age, take-home pay, cash, retirement, card balance and APR, other
// loans. A value the user types is measured; a skipped one stays an estimate. Debts are confirm, not
// type (JF17): debt payments found in the statement come up as a card to confirm; a new debt needs
// only its balance (APR and minimum prefilled from engine defaults, tagged estimate). Every value is
// clamped to what the profile contract accepts, so a half-typed number never breaks the profile.
import { debtAprDefaults, tenureOf } from '@lifeguessr/engine';
import { DEBT_KINDS, type Debt, type HomeTenure, type Money } from '@lifeguessr/types';
import { useCallback, useMemo, useState } from 'react';
import { parseImage } from '@/lib/api/aiParseImage';
import { track } from '@/lib/events';
import { toVMError } from '@/lib/model/errors';
import { homeArea, homeSummary } from '@/lib/model/home';
import { debtLoadGauge, netWorthToday, thisMonth } from '@/lib/model/profile';
import { getAnonId } from '@/state/anonId';
import { useAppReady, useAppStore, useProfile, type DebtInput } from '@/state';
import { estimatedMinPayment } from '@/state/profileOps';
import { BALANCE_FIELD_BOUNDS, DEBT_BOUNDS, DEBT_LOAD_GAUGE_MAX, HOME_BOUNDS, HOME_TENURES } from './constants';
import type { BalanceFieldKey, BalanceSheetVM, DebtRowVM, HomeSectionVM, InputBounds, ScanDebtOutcome } from './types';

/** JF9: statement photo → debt values to confirm (swappable in tests). */
export async function scanStatement(file: File): Promise<ScanDebtOutcome> {
  try {
    return { ok: true, value: await parseImage('debt', file, { anonId: getAnonId() }) };
  } catch (err) {
    return { ok: false, error: toVMError(err) };
  }
}

const FIELDS: readonly BalanceFieldKey[] = ['age', 'takeHomePay', 'cash', 'retirement'];

const within = (v: number, { min, max }: InputBounds) => Math.min(max, Math.max(min, v));

/** Funnel: the balance sheet was used (a value typed, skipped, or a debt changed). */
const edited = () => track({ name: 'balance_sheet_edited' }, { once: 'balance_sheet_edited' });

/** A typed field value inside its bounds (age in whole years); null when it is not a number. */
export function clampField(field: BalanceFieldKey, value: number): number | null {
  if (!Number.isFinite(value)) return null;
  const v = within(value, BALANCE_FIELD_BOUNDS[field]);
  return field === 'age' ? Math.round(v) : v;
}

/** A debt row inside its bounds (balance and payment ≥ 0, APR a decimal 0–1); null when not numbers. */
export function clampDebt(input: DebtInput): DebtInput | null {
  if (!Number.isFinite(input.balance) || !Number.isFinite(input.apr)) return null;
  if (input.minPayment !== null && !Number.isFinite(input.minPayment)) return null;
  return {
    kind: input.kind,
    balance: within(input.balance, DEBT_BOUNDS.balance),
    apr: within(input.apr, DEBT_BOUNDS.apr),
    minPayment: input.minPayment === null ? null : within(input.minPayment, DEBT_BOUNDS.minPayment),
  };
}

/** Mean monthly debt payments over the statement months that have them; null when none. */
export function detectedDebtPayments(
  months: readonly { totals: Partial<Record<string, number>> }[],
): { monthlyPayment: Money; months: number } | null {
  const values = months.map((m) => m.totals.debtPayments).filter((v): v is number => typeof v === 'number' && v > 0);
  if (values.length === 0) return null;
  return { monthlyPayment: values.reduce((t, v) => t + v, 0) / values.length, months: values.length };
}

export function useBalanceSheet(): BalanceSheetVM {
  const ready = useAppReady();
  const profile = useProfile();
  const setFieldAction = useAppStore((s) => s.setField);
  const skipField = useAppStore((s) => s.skipField);
  const addDebtAction = useAppStore((s) => s.addDebt);
  const updateDebtAction = useAppStore((s) => s.updateDebt);
  const removeDebt = useAppStore((s) => s.removeDebt);
  const setHomeAction = useAppStore((s) => s.setHome);
  const statementMonths = useAppStore((s) => s.statementMonths);
  const [dismissed, setDismissed] = useState(false);

  const fields = useMemo(
    () => Object.fromEntries(FIELDS.map((f) => [f, { ...profile[f] }])) as BalanceSheetVM['fields'],
    [profile],
  );

  const debts: DebtRowVM[] = useMemo(
    () =>
      profile.debts.map((d) => ({
        id: d.id,
        kind: d.kind,
        balance: d.balance,
        apr: d.apr,
        minPayment: d.minPayment.value,
        minPaymentIsEstimate: d.minPayment.isEstimate,
      })),
    [profile.debts],
  );

  const month = useMemo(() => thisMonth(profile), [profile]);
  const netWorth = useMemo(() => netWorthToday(profile), [profile]);

  const setField = useCallback(
    (field: BalanceFieldKey, value: number) => {
      const v = clampField(field, value);
      if (v === null) return;
      setFieldAction(field, v);
      edited();
    },
    [setFieldAction],
  );

  const addDebt = useCallback(
    (input: DebtInput) => {
      const clean = clampDebt(input);
      if (!clean) return '';
      edited();
      return addDebtAction(clean);
    },
    [addDebtAction],
  );

  const updateDebt = useCallback(
    (id: string, input: DebtInput) => {
      const clean = clampDebt(input);
      if (!clean) return;
      updateDebtAction(id, clean);
      edited();
    },
    [updateDebtAction],
  );

  // JF4 "Your home": the area the profile's ZIP uses prices the defaults and the owner costs.
  const area = useMemo(() => homeArea(profile.zip), [profile.zip]);
  const tenure = tenureOf(profile);
  const summary = useMemo(() => homeSummary(profile), [profile]);
  const hasMortgage = profile.debts.some((d) => d.kind === 'mortgage');
  const home: HomeSectionVM = useMemo(() => {
    const setHome = (next: HomeTenure, input?: { value?: Money; hoaMonthly?: Money }) => {
      setHomeAction(next, area, input);
      edited();
    };
    const owned = (): Exclude<HomeTenure, 'rent'> => (tenure === 'rent' ? 'mortgage' : tenure);
    return {
      tenure,
      tenures: HOME_TENURES,
      summary,
      bounds: HOME_BOUNDS,
      needsMortgage: tenure === 'mortgage' && !hasMortgage,
      mortgageWhileOutright: tenure === 'outright' && hasMortgage,
      setTenure: (next) => setHome(next),
      setValue: (value) => {
        if (Number.isFinite(value)) setHome(owned(), { value: within(value, HOME_BOUNDS.value) });
      },
      setHoaMonthly: (value) => {
        if (Number.isFinite(value)) setHome(owned(), { hoaMonthly: within(value, HOME_BOUNDS.hoaMonthly) });
      },
    };
  }, [tenure, summary, hasMortgage, area, setHomeAction]);

  const detected = useMemo(() => detectedDebtPayments(statementMonths), [statementMonths]);
  const detectedDebt = detected && !dismissed && profile.debts.length === 0 ? detected : null;

  const confirmDetected = useCallback(
    (kind: Debt['kind'], balance: Money) => {
      if (!detected) return '';
      setDismissed(true);
      // The payment seen in the statement is the user's own: kept as their payment (measured).
      return addDebt({ kind, balance, apr: debtAprDefaults.value[kind], minPayment: detected.monthlyPayment });
    },
    [detected, addDebt],
  );

  return {
    status: ready ? 'ready' : 'loading',
    fields,
    fieldBounds: BALANCE_FIELD_BOUNDS,
    debts,
    debtKinds: DEBT_KINDS,
    debtBounds: DEBT_BOUNDS,
    debtAprDefaults: debtAprDefaults.value,
    estimateMinPayment: estimatedMinPayment,
    home,
    detectedDebt,
    confirmDetected,
    dismissDetected: () => setDismissed(true),
    debtLoad: debtLoadGauge(month.debtLoad),
    debtLoadMax: DEBT_LOAD_GAUGE_MAX,
    netWorth,
    setField,
    skipField: (field) => {
      skipField(field);
      edited();
    },
    addDebt,
    scanStatement,
    updateDebt,
    removeDebt: (id) => {
      removeDebt(id);
      edited();
    },
  };
}
