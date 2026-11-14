// S9 Statement upload: screen state around the T6/T7 pipeline (features/upload parses the CSV in
// the browser and calls /api/statement/categorize). Its output, CategoryTotals[], enters here via
// `submitTotals`, is shown for review, and on `apply` becomes measured spending in the profile.
import { CategoryTotalsSchema, COST_CATEGORIES, type CategoryTotals, type CostCategory } from '@lifeguessr/types';
import { useCallback, useMemo, useState } from 'react';
import { sessionSource } from '@/lib/config';
import { track } from '@/lib/events';
import type { VMError } from '@/lib/model/types';
import { useAppReady, useAppStore } from '@/state';
import type { StatementMonthVM, StatementUploadVM } from './types';

/** Months needed before Today shows drift flags (ENGINEERING.md → Month-end). */
export const DRIFT_HISTORY_MONTHS = 3;

function monthVM(m: CategoryTotals): StatementMonthVM {
  return {
    month: m.month,
    totals: { ...m.totals },
    total: COST_CATEGORIES.reduce((s, c) => s + (m.totals[c] ?? 0), 0),
    oneOffs: m.oneOffs.map((o) => ({ ...o })),
    detectedPay: m.detectedPay ?? null,
  };
}

export function useStatementUpload(): StatementUploadVM {
  const ready = useAppReady();
  const statementMonths = useAppStore((s) => s.statementMonths);
  const applyStatementTotals = useAppStore((s) => s.applyStatementTotals);

  const [pending, setPending] = useState<CategoryTotals[] | null>(null);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<VMError | null>(null);

  const submitTotals = useCallback((totals: CategoryTotals[]) => {
    const parsed = CategoryTotalsSchema.array().min(1).safeParse(totals);
    setApplied(false);
    if (!parsed.success) {
      setPending(null);
      setError({ kind: 'badInput' });
      return;
    }
    setError(null);
    setPending([...parsed.data].sort((a, b) => a.month.localeCompare(b.month)));
  }, []);

  const apply = useCallback(() => {
    if (!pending) return;
    applyStatementTotals(pending);
    track({ name: 'statement_applied', props: { months: pending.length } });
    setPending(null);
    setApplied(true);
  }, [pending, applyStatementTotals]);

  const discard = useCallback(() => {
    setPending(null);
    setError(null);
    setApplied(false);
  }, []);

  const history = useMemo(() => statementMonths.map((m) => m.month), [statementMonths]);
  const whatWeKeep = useMemo(() => {
    const months = [...new Set([...history, ...(pending ?? []).map((m) => m.month)])].sort();
    const kept = [...statementMonths, ...(pending ?? [])];
    return {
      months,
      categories: months.length > 0 ? ([...COST_CATEGORIES] as CostCategory[]) : [],
      takeHomePay: kept.some((m) => (m.detectedPay ?? 0) > 0),
      savedProfileToServer: sessionSource() === 'api',
    };
  }, [history, pending, statementMonths]);

  const status: StatementUploadVM['status'] = !ready
    ? 'loading'
    : error
      ? 'error'
      : pending
        ? 'review'
        : applied
          ? 'applied'
          : 'idle';

  return {
    status,
    error,
    pending: (pending ?? []).map(monthVM),
    history,
    hasDriftHistory: history.length >= DRIFT_HISTORY_MONTHS,
    whatWeKeep,
    // T6/T7 (features/upload) replaces this with the in-browser CSV reader + categorize call.
    readFile: null,
    submitTotals,
    apply,
    discard,
  };
}
