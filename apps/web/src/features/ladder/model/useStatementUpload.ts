// S9 Statement upload: screen state around the T6/T7 pipeline (features/upload parses the CSV in
// the browser and calls /api/statement/categorize). Its output, CategoryTotals[], enters here via
// `submitTotals`, is shown for review, and on `apply` becomes measured spending in the profile.
import { CategoryTotalsSchema, COST_CATEGORIES, type CategoryTotals, type CostCategory } from '@lifeguessr/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { readStatementFile as defaultReadStatementFile, StatementFileError } from '@/features/upload/model/readStatementFile';
import { sessionSource } from '@/lib/config';
import { track } from '@/lib/events';
import { toVMError } from '@/lib/model/errors';
import { useAppReady, useAppStore } from '@/state';
import { getAnonId } from '@/state/anonId';
import type { StatementMonthVM, StatementReadVM, StatementUploadError, StatementUploadVM } from './types';

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

export type StatementUploadOptions = {
  /** The T6/T7 pipeline (swappable in tests). */
  readStatementFile?: typeof defaultReadStatementFile;
};

export function useStatementUpload(opts: StatementUploadOptions = {}): StatementUploadVM {
  const readStatementFile = opts.readStatementFile ?? defaultReadStatementFile;
  const ready = useAppReady();
  const statementMonths = useAppStore((s) => s.statementMonths);
  const applyStatementTotals = useAppStore((s) => s.applyStatementTotals);

  const [pending, setPending] = useState<CategoryTotals[] | null>(null);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<StatementUploadError | null>(null);
  const [reading, setReading] = useState(false);
  const [lastRead, setLastRead] = useState<StatementReadVM | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

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

  const readFile = useCallback((file: File) => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setReading(true);
    setError(null);
    setPending(null);
    setApplied(false);
    setLastRead(null);
    readStatementFile(file, { anonId: getAnonId(), signal: controller.signal }).then(
      ({ months, summary }) => {
        if (controller.signal.aborted) return;
        setReading(false);
        const { convention: _convention, ...shown } = summary;
        setLastRead(shown);
        submitTotals(months);
      },
      (err: unknown) => {
        if (controller.signal.aborted) return;
        setReading(false);
        setError(err instanceof StatementFileError ? { kind: 'unreadable', reason: err.problem } : toVMError(err));
      },
    );
  }, [readStatementFile, submitTotals]);

  const apply = useCallback(() => {
    if (!pending) return;
    applyStatementTotals(pending);
    track({ name: 'statement_applied', props: { months: pending.length } });
    setPending(null);
    setLastRead(null);
    setApplied(true);
  }, [pending, applyStatementTotals]);

  const discard = useCallback(() => {
    abort.current?.abort();
    setReading(false);
    setPending(null);
    setLastRead(null);
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
    : reading
      ? 'reading'
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
    lastRead: pending ? lastRead : null,
    pending: (pending ?? []).map(monthVM),
    history,
    hasDriftHistory: history.length >= DRIFT_HISTORY_MONTHS,
    whatWeKeep,
    readFile,
    submitTotals,
    apply,
    discard,
  };
}
