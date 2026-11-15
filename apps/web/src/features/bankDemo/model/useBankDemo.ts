// The demo bank link (DEMO, labelled as such everywhere it shows): pick a made-up bank, "sign in" with
// demo credentials that go nowhere, watch it connect, see the accounts its statement shows, then hand
// that statement to the caller as a CSV File. The caller feeds it to the same pipeline as an uploaded
// CSV (useStatementUpload.readFile on /start, the ledger import on /transactions), so the review and
// every number after it come from the statement, as for any file.
import { useCallback, useEffect, useMemo, useReducer } from 'react';
import { bankDemo as copy } from '@/copy';
import { demoBank, demoStatementFileName, searchDemoBanks, type DemoBankId } from './banks';
import { fetchDemoStatement as defaultFetch } from './fetchDemoStatement';
import { CONNECT_STEPS, connectSteps, flowReducer, INITIAL_FLOW } from './flow';
import { previewStatement } from './preview';
import type { BankDemoVM, DemoBankVM } from './types';

/** How long each connecting step shows (ms); shorter under prefers-reduced-motion. */
export const STEP_MS = 650;
export const REDUCED_STEP_MS = 120;

export type UseBankDemoOptions = {
  /** Gets the statement File once the person taps "Use these transactions". */
  onUse: (file: File) => void;
  /** Downloads a bank's statement text (swappable in tests). */
  fetchStatement?: typeof defaultFetch;
  stepMs?: number;
};

const nameOf = (id: DemoBankId) => copy.banks[id];
const bankVM = (id: DemoBankId): DemoBankVM => {
  const b = demoBank(id);
  return { id, name: nameOf(id), initials: b.initials, tone: b.tone };
};

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useBankDemo({ onUse, fetchStatement = defaultFetch, stepMs }: UseBankDemoOptions): BankDemoVM {
  const [s, dispatch] = useReducer(flowReducer, INITIAL_FLOW);
  const connecting = s.step === 'connecting';

  // Download and read the statement once per attempt.
  useEffect(() => {
    if (!connecting || !s.bankId) return;
    const controller = new AbortController();
    fetchStatement(s.bankId, { signal: controller.signal })
      .then((text) => {
        if (!controller.signal.aborted) dispatch({ type: 'loaded', preview: previewStatement(text) });
      })
      .catch(() => {
        if (!controller.signal.aborted) dispatch({ type: 'failed' });
      });
    return () => controller.abort();
  }, [connecting, s.bankId, s.attempt, fetchStatement]);

  // One step at a time.
  useEffect(() => {
    if (!connecting || s.progress >= CONNECT_STEPS.length) return;
    const id = setTimeout(() => dispatch({ type: 'tick' }), stepMs ?? (reducedMotion() ? REDUCED_STEP_MS : STEP_MS));
    return () => clearTimeout(id);
  }, [connecting, s.progress, stepMs]);

  const banks = useMemo(() => searchDemoBanks(s.query, nameOf).map((b) => bankVM(b.id)), [s.query]);
  const bank = useMemo(() => (s.bankId ? bankVM(s.bankId) : null), [s.bankId]);
  const steps = useMemo(() => connectSteps(s), [s]);

  const start = useCallback(() => dispatch({ type: 'open' }), []);
  const close = useCallback(() => dispatch({ type: 'close' }), []);
  const search = useCallback((query: string) => dispatch({ type: 'search', query }), []);
  const pick = useCallback((bankId: DemoBankId) => dispatch({ type: 'pick', bankId }), []);
  const back = useCallback(() => dispatch({ type: 'back' }), []);
  const connect = useCallback(() => dispatch({ type: 'connect' }), []);

  const { preview, bankId } = s;
  const use = useCallback(() => {
    if (!preview || !bankId) return;
    onUse(new File([preview.text], demoStatementFileName(bankId), { type: 'text/csv' }));
    dispatch({ type: 'close' });
  }, [preview, bankId, onUse]);

  return {
    open: s.step !== 'closed',
    step: s.step,
    query: s.query,
    banks,
    bank,
    steps,
    days: s.preview?.days ?? null,
    accounts: s.step === 'connected' ? (s.preview?.accounts ?? []) : [],
    start,
    close,
    search,
    pick,
    back,
    connect,
    retry: connect,
    use,
  };
}
