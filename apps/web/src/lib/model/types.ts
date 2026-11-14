// View-model building blocks shared by several features. Each feature's model/types.ts re-exports
// the ones its UI needs, so ui/ files keep importing only from ../model/types.
import type { CostCategory, Money } from '@lifeguessr/types';

/**
 * Why a view-model could not produce its data. The UI maps `kind` to copy; no sentences here.
 * - notImplemented: an engine function is still being built (its task id is in `task`).
 * - unavailable: the server route does not exist yet (404/405/501).
 * - network: the request failed or returned another non-2xx status.
 * - invalidResponse: the response did not match the contract (zod).
 * - rateLimited: 429.
 * - alreadyGuessed: the server already has a guess for this card today (409).
 * - badInput: the server rejected the input (400/422), e.g. text the parser could not read.
 * - nothingFound: the text parser returned no values (offer the manual form).
 * - unknown: anything else (message for logs, not for display).
 */
export type VMError =
  | { kind: 'notImplemented'; task: string }
  | { kind: 'unavailable' }
  | { kind: 'network'; status?: number }
  | { kind: 'invalidResponse' }
  | { kind: 'rateLimited' }
  | { kind: 'alreadyGuessed' }
  | { kind: 'badInput' }
  | { kind: 'nothingFound' }
  | { kind: 'unknown'; message: string };

/** Data that may still be loading or may have failed. */
export type Loadable<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'error'; error: VMError };

/** A numeric slider: value plus bounds. `position` (0–1) is set on log-scale sliders. */
export type SliderVM = {
  value: number;
  min: number;
  max: number;
  step: number;
  /** 0–1 along the track; for log-scale sliders this is the log position. */
  position: number;
};

/**
 * Free text → typed values through POST /api/ai/parse, shown to the user before they are applied.
 * idle → (submit) parsing → confirming (show `parsed`) → (confirm) idle, or → error.
 */
export type ParseConfirmVM<T> = {
  text: string;
  status: 'idle' | 'parsing' | 'confirming' | 'error';
  /** The parsed values awaiting confirmation (status 'confirming'). */
  parsed: T | null;
  error: VMError | null;
  setText: (text: string) => void;
  /** Send `text` to the parser. Ignored when the text is blank or a parse is running. */
  submit: () => void;
  /** Apply `parsed` and return to idle. */
  confirm: () => void;
  /** Drop `parsed` (or the error) and return to idle, keeping the text. */
  cancel: () => void;
};

/** An input the forecast reads that is an estimate (drives the range band and "make it exact"). */
export type EstimatedField =
  | { field: 'takeHomePay' | 'cash' | 'retirement' | 'retirementShare' | 'age' }
  | { field: 'spending'; category: CostCategory }
  | { field: 'debtMinPayment'; debtId: string };

/** A monthly amount with whether we estimated it. */
export type EstimatedMoney = { value: Money; isEstimate: boolean };
