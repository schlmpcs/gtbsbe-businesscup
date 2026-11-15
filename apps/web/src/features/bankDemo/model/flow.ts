// The demo bank link's state machine (pure; useBankDemo runs its timer and download). Connecting ends
// when every step has had its turn AND the statement is read, so the animation never shows "Connected"
// for data that isn't there, and a slow download keeps the last step active.
import type { DemoBankId } from './banks';
import type { BankDemoStep, ConnectStepId, ConnectStepVM, DemoPreview } from './types';

export const CONNECT_STEPS: readonly ConnectStepId[] = ['verify', 'accounts', 'transactions'];

export type FlowState = {
  step: BankDemoStep;
  bankId: DemoBankId | null;
  query: string;
  /** Connecting steps finished (0 … CONNECT_STEPS.length). */
  progress: number;
  preview: DemoPreview | null;
  /** Counts connection attempts, so a retry downloads again. */
  attempt: number;
};

export type FlowAction =
  | { type: 'open' }
  | { type: 'close' }
  | { type: 'search'; query: string }
  | { type: 'pick'; bankId: DemoBankId }
  | { type: 'back' }
  | { type: 'connect' }
  | { type: 'tick' }
  | { type: 'loaded'; preview: DemoPreview }
  | { type: 'failed' };

export const INITIAL_FLOW: FlowState = { step: 'closed', bankId: null, query: '', progress: 0, preview: null, attempt: 0 };

const finished = (s: FlowState): FlowState =>
  s.progress >= CONNECT_STEPS.length && s.preview ? { ...s, step: 'connected' } : s;

export function flowReducer(s: FlowState, a: FlowAction): FlowState {
  switch (a.type) {
    case 'open':
      return { ...INITIAL_FLOW, step: 'pick', attempt: s.attempt };
    case 'close':
      return { ...INITIAL_FLOW, attempt: s.attempt };
    case 'search':
      return s.step === 'pick' ? { ...s, query: a.query } : s;
    case 'pick':
      return s.step === 'pick' ? { ...s, step: 'signin', bankId: a.bankId } : s;
    case 'back':
      if (s.step === 'signin') return { ...s, step: 'pick', bankId: null };
      if (s.step === 'connecting' || s.step === 'error') return { ...s, step: 'signin', progress: 0, preview: null };
      if (s.step === 'connected') return { ...s, step: 'pick', bankId: null, progress: 0, preview: null };
      return s;
    case 'connect':
      return s.step === 'signin' || s.step === 'error'
        ? { ...s, step: 'connecting', progress: 0, preview: null, attempt: s.attempt + 1 }
        : s;
    case 'tick':
      return s.step === 'connecting' ? finished({ ...s, progress: Math.min(s.progress + 1, CONNECT_STEPS.length) }) : s;
    case 'loaded':
      return s.step === 'connecting' ? finished({ ...s, preview: a.preview }) : s;
    case 'failed':
      return s.step === 'connecting' ? { ...s, step: 'error' } : s;
  }
}

/** Each connecting step's status. The last one stays active until the statement is read. */
export function connectSteps(s: Pick<FlowState, 'step' | 'progress' | 'preview'>): ConnectStepVM[] {
  return CONNECT_STEPS.map((id, i) => {
    if (s.step === 'connected') return { id, status: 'done' };
    const last = i === CONNECT_STEPS.length - 1;
    const done = i < s.progress && (!last || s.preview !== null);
    const active = !done && (i === s.progress || (last && s.progress >= CONNECT_STEPS.length));
    return { id, status: done ? 'done' : active ? 'active' : 'todo' };
  });
}
