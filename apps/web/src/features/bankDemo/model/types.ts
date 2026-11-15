// View-model types for the demo bank link (DEMO: made-up banks, sample statements, nothing sent). The
// contract with bankDemo/ui/*, which may import only this file, @/ui-kit/** and @/copy (lint-enforced).
import type { DemoBankId, DemoBankTone } from './banks';

export type { DemoBankId, DemoBankTone } from './banks';

/** closed → pick a bank → sign in (demo credentials) → connecting → connected (or error). */
export type BankDemoStep = 'closed' | 'pick' | 'signin' | 'connecting' | 'connected' | 'error';

export type ConnectStepId = 'verify' | 'accounts' | 'transactions';

export type ConnectStepVM = { id: ConnectStepId; status: 'done' | 'active' | 'todo' };

/** An account the demo statement shows (read from it, not typed in). Dates are 'YYYY-MM-DD'. */
export type DemoAccountVM =
  | { kind: 'checking'; transactions: number; days: number; from: string; to: string }
  | { kind: 'card'; /** Card payment lines in the checking statement. */ payments: number };

/** A demo statement read in the browser, ready to hand to the CSV pipeline. */
export type DemoPreview = { text: string; days: number; accounts: DemoAccountVM[] };

export type DemoBankVM = { id: DemoBankId; name: string; initials: string; tone: DemoBankTone };

export type BankDemoVM = {
  open: boolean;
  step: BankDemoStep;
  query: string;
  /** Banks matching `query`. */
  banks: DemoBankVM[];
  /** The bank picked (from sign-in on). */
  bank: DemoBankVM | null;
  /** The connecting steps, in order. */
  steps: ConnectStepVM[];
  /** Days the statement covers, once it is read (null before). */
  days: number | null;
  /** What the statement shows, once connected. */
  accounts: DemoAccountVM[];
  start: () => void;
  close: () => void;
  search: (query: string) => void;
  pick: (id: DemoBankId) => void;
  back: () => void;
  connect: () => void;
  retry: () => void;
  /** Hand the statement to the CSV pipeline (as a File) and close. */
  use: () => void;
};
