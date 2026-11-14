// S9 Statement upload: screen state around the T6/T7 pipeline (features/upload parses the CSV in
// the browser and calls /api/statement/categorize). Its output, CategoryTotals[], enters here via
// `submitTotals`, is shown for review, and on `apply` becomes measured spending in the profile.
//
// Follow-up questions (JF6): the server sends a few things the statement couldn't settle (an
// unclear store, cash, a category with nothing in it). An answer naming a category re-sorts that
// store's lines and the months are summed again here, by the same engine function the server used
// (statementTotals), so the review shows the effect at once and no number comes from the model. A
// typed amount for a missing category becomes that category's value when the months are applied.
// The classified lines live only in this hook's memory; only the category totals are saved.
import {
  applyFollowUpAnswers, averagedStatementMonths, FOLLOW_UP_CATEGORIES, statementTotals, type ClassifiedStatementItem,
} from '@lifeguessr/engine';
import {
  CategoryTotalsSchema, COST_CATEGORIES, type CategoryTotals, type CostCategory, type Money, type StatementFollowUp,
} from '@lifeguessr/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePublishedAvatar } from '@/features/avatar/model/usePublishedAvatar';
import { readStatementFile as defaultReadStatementFile, StatementFileError } from '@/features/upload/model/readStatementFile';
import { fetchSampleStatement as defaultFetchSampleStatement } from '@/features/upload/model/sampleStatement';
import { sessionSource } from '@/lib/config';
import { track } from '@/lib/events';
import { toVMError } from '@/lib/model/errors';
import { useAppReady, useAppStore } from '@/state';
import { getAnonId } from '@/state/anonId';
import type {
  InputBounds, StatementAnswerVM, StatementMonthVM, StatementQuestionVM, StatementReadVM, StatementUploadError, StatementUploadVM,
} from './types';

/** Months needed before Today shows drift flags (ENGINEERING.md → Month-end). */
export const DRIFT_HISTORY_MONTHS = 3;

/** A typed monthly amount for a missing category: whole dollars, a sanity cap only. */
export const FOLLOW_UP_AMOUNT_BOUNDS: InputBounds = { min: 0, max: 100_000, step: 1 };

/**
 * A masked label as the user can read it: a masked person becomes "someone", ids and masked digits
 * go. "Zelle to [name]" → "Zelle to someone"; "TARGET # DALLAS TX" → "TARGET DALLAS TX".
 */
export function readableLabel(label: string): string {
  const out = label
    .replace(/\[name\]/gi, 'someone')
    .replace(/\[(?:ref|email)\]/gi, ' ')
    .replace(/[#*]+(?:\/#+)*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return out === '' ? label : out;
}

/** The statement as the server sorted it, and its follow-ups, for the file under review. */
type Sorted = { classified: ClassifiedStatementItem[]; followUps: StatementFollowUp[] };

function questionVM(f: StatementFollowUp, answer: StatementAnswerVM | null): StatementQuestionVM {
  return {
    id: f.id,
    kind: f.kind,
    question: f.question ?? null,
    merchant: f.kind === 'merchant' && f.label ? readableLabel(f.label) : null,
    category: f.kind === 'missing' ? (f.category ?? null) : null,
    monthly: f.monthly,
    options: f.kind === 'missing' ? [] : [...FOLLOW_UP_CATEGORIES],
    answer,
  };
}

function monthVM(m: CategoryTotals, averaged: boolean): StatementMonthVM {
  return {
    averaged,
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
  /** Downloads the sample statement fixture as a File (swappable in tests). */
  fetchSampleStatement?: typeof defaultFetchSampleStatement;
};

export function useStatementUpload(opts: StatementUploadOptions = {}): StatementUploadVM {
  const readStatementFile = opts.readStatementFile ?? defaultReadStatementFile;
  const fetchSampleStatement = opts.fetchSampleStatement ?? defaultFetchSampleStatement;
  const ready = useAppReady();
  const avatarPublished = usePublishedAvatar(ready);
  const statementMonths = useAppStore((s) => s.statementMonths);
  const applyStatementTotals = useAppStore((s) => s.applyStatementTotals);

  const setSpending = useAppStore((s) => s.setSpending);

  const [pending, setPending] = useState<CategoryTotals[] | null>(null);
  const [sorted, setSorted] = useState<Sorted | null>(null);
  const [answers, setAnswers] = useState<Record<string, StatementAnswerVM>>({});
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<StatementUploadError | null>(null);
  const [reading, setReading] = useState(false);
  const [lastRead, setLastRead] = useState<StatementReadVM | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  /** Validate months for review, with how their lines were sorted when known (a fresh set of answers). */
  const review = useCallback((totals: CategoryTotals[], sortedLines: Sorted | null) => {
    const parsed = CategoryTotalsSchema.array().min(1).safeParse(totals);
    setApplied(false);
    setAnswers({});
    if (!parsed.success) {
      setPending(null);
      setSorted(null);
      setError({ kind: 'badInput' });
      return;
    }
    setError(null);
    setSorted(sortedLines);
    setPending([...parsed.data].sort((a, b) => a.month.localeCompare(b.month)));
  }, []);
  const submitTotals = useCallback((totals: CategoryTotals[]) => review(totals, null), [review]);

  /** Forget the file under review: its months, how its lines were sorted and the answers. */
  const clearReview = useCallback(() => {
    setPending(null);
    setSorted(null);
    setAnswers({});
    setLastRead(null);
  }, []);

  /** Read a statement file (the user's, or the downloaded sample) through the one pipeline. */
  const read = useCallback((source: File | ((signal: AbortSignal) => Promise<File>)) => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setReading(true);
    setError(null);
    clearReview();
    setApplied(false);
    const readOne = (file: File) => readStatementFile(file, { anonId: getAnonId(), signal: controller.signal });
    (typeof source === 'function' ? source(controller.signal).then(readOne) : readOne(source))
      .then(
        ({ months, summary, classified, followUps }) => {
          if (controller.signal.aborted) return;
          setReading(false);
          const { convention: _convention, ...shown } = summary;
          setLastRead(shown);
          review(months, classified ? { classified, followUps } : null);
        },
        (err: unknown) => {
          if (controller.signal.aborted) return;
          setReading(false);
          setError(err instanceof StatementFileError ? { kind: 'unreadable', reason: err.problem } : toVMError(err));
        },
      );
  }, [readStatementFile, review, clearReview]);

  const readFile = useCallback((file: File) => read(file), [read]);
  const trySample = useCallback(
    () => read((signal) => fetchSampleStatement({ signal })),
    [read, fetchSampleStatement],
  );

  // The months under review with the category answers applied: the lines of an answered store are
  // re-sorted and every month summed again by the engine. Without answers (or without the line
  // classes) they are the server's months as they came.
  const categoryAnswers = useMemo(() => {
    const out: Record<string, CostCategory> = {};
    for (const [id, a] of Object.entries(answers)) if (a.kind === 'category') out[id] = a.category;
    return out;
  }, [answers]);
  const reviewed = useMemo(() => {
    if (!pending) return null;
    if (!sorted || Object.keys(categoryAnswers).length === 0) return pending;
    return statementTotals(applyFollowUpAnswers(sorted.classified, sorted.followUps, categoryAnswers));
  }, [pending, sorted, categoryAnswers]);

  const followUpsById = useMemo(() => new Map((sorted?.followUps ?? []).map((f) => [f.id, f])), [sorted]);
  const answer = useCallback((id: string, a: StatementAnswerVM) => {
    if (!followUpsById.has(id)) return;
    setAnswers((prev) => ({ ...prev, [id]: a }));
  }, [followUpsById]);
  const answerCategory = useCallback((id: string, category: CostCategory) => {
    const f = followUpsById.get(id);
    if (!f || f.kind === 'missing' || !FOLLOW_UP_CATEGORIES.includes(category)) return;
    answer(id, { kind: 'category', category });
  }, [followUpsById, answer]);
  const answerAmount = useCallback((id: string, monthly: Money) => {
    const f = followUpsById.get(id);
    if (!f || f.kind !== 'missing' || !Number.isFinite(monthly)) return;
    const { min, max } = FOLLOW_UP_AMOUNT_BOUNDS;
    answer(id, { kind: 'amount', monthly: Math.min(max, Math.max(min, monthly)) });
  }, [followUpsById, answer]);
  const skipQuestion = useCallback((id: string) => answer(id, { kind: 'skipped' }), [answer]);

  const apply = useCallback(() => {
    if (!reviewed) return;
    applyStatementTotals(reviewed);
    // A category the statement has none of, priced by the user: what they typed is their number
    // (measured, like a slider they set). It isn't written into the months: those stay what the
    // statement shows, so month-end never mistakes a typed amount for history.
    for (const [id, a] of Object.entries(answers)) {
      const category = followUpsById.get(id)?.category;
      if (a.kind === 'amount' && category) setSpending(category, a.monthly);
    }
    track({ name: 'statement_applied', props: { months: reviewed.length } });
    clearReview();
    setApplied(true);
  }, [reviewed, answers, followUpsById, applyStatementTotals, setSpending, clearReview]);

  const discard = useCallback(() => {
    abort.current?.abort();
    setReading(false);
    clearReview();
    setError(null);
    setApplied(false);
  }, [clearReview]);

  const history = useMemo(() => statementMonths.map((m) => m.month), [statementMonths]);
  const whatWeKeep = useMemo(() => {
    const months = [...new Set([...history, ...(reviewed ?? []).map((m) => m.month)])].sort();
    const kept = [...statementMonths, ...(reviewed ?? [])];
    return {
      months,
      categories: months.length > 0 ? ([...COST_CATEGORIES] as CostCategory[]) : [],
      takeHomePay: kept.some((m) => (m.detectedPay ?? 0) > 0),
      ...(avatarPublished && {avatarPublished}),
      savedProfileToServer: sessionSource() === 'api',
    };
  }, [history, reviewed, statementMonths, avatarPublished]);

  const pendingVM = useMemo(() => {
    const months = reviewed ?? [];
    const averaged = new Set(averagedStatementMonths(months).map((m) => m.month));
    return months.map((m) => monthVM(m, averaged.has(m.month)));
  }, [reviewed]);

  const status: StatementUploadVM['status'] = !ready
    ? 'loading'
    : reading
      ? 'reading'
      : error
        ? 'error'
        : reviewed
          ? 'review'
          : applied
            ? 'applied'
            : 'idle';

  return {
    status,
    error,
    lastRead: reviewed ? lastRead : null,
    pending: pendingVM,
    questions: reviewed ? (sorted?.followUps ?? []).map((f) => questionVM(f, answers[f.id] ?? null)) : [],
    answerCategory,
    answerAmount,
    skipQuestion,
    amountBounds: FOLLOW_UP_AMOUNT_BOUNDS,
    history,
    hasDriftHistory: history.length >= DRIFT_HISTORY_MONTHS,
    whatWeKeep,
    readFile,
    trySample,
    submitTotals,
    apply,
    discard,
  };
}
