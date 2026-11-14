// S8 Balance sheet in six taps: age, take-home pay, cash, retirement, card balance and APR, other
// loans. A value the user types is measured; a skipped one stays an estimate.
import { useMemo } from 'react';
import { debtLoadGauge, netWorthToday, thisMonth } from '@/lib/model/profile';
import { useAppReady, useAppStore } from '@/state';
import type { BalanceFieldKey, BalanceSheetVM, DebtRowVM } from './types';

const FIELDS: readonly BalanceFieldKey[] = ['age', 'takeHomePay', 'cash', 'retirement'];

export function useBalanceSheet(): BalanceSheetVM {
  const ready = useAppReady();
  const profile = useAppStore((s) => s.profile);
  const setField = useAppStore((s) => s.setField);
  const skipField = useAppStore((s) => s.skipField);
  const addDebt = useAppStore((s) => s.addDebt);
  const updateDebt = useAppStore((s) => s.updateDebt);
  const removeDebt = useAppStore((s) => s.removeDebt);

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

  return {
    status: ready ? 'ready' : 'loading',
    fields,
    debts,
    debtLoad: debtLoadGauge(month.debtLoad),
    netWorth,
    setField: (field, value) => setField(field, value),
    skipField: (field) => skipField(field),
    addDebt,
    updateDebt,
    removeDebt,
  };
}
