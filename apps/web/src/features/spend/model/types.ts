// View-model contracts for the daily spending log (/spend and the quick-add on Home).
// ui/ files import types from here only.
import type { CostCategory, Money } from '@lifeguessr/types';
import type { SpendPresetId } from '@/copy';
import type { Loadable } from '@/lib/model/types';

export type { CostCategory, Money } from '@lifeguessr/types';
export type { Loadable, VMError } from '@/lib/model/types';
export type { SpendPresetId } from '@/copy';

/** A one-tap chip. Its price is a typical amount we picked (isEstimate), not the user's. */
export type SpendPresetVM = { id: SpendPresetId; emoji: string; category: CostCategory; amount: Money; isEstimate: true };

/** One purchase waiting for the user's OK (after the AI read the line, or the local fallback). */
export type SpendDraftVM = {
  key: string;
  category: CostCategory;
  amount: Money;
  label?: string;
  /** No category was found for it: the UI asks the user to pick one. */
  categoryGuessed: boolean;
};

export type QuickAddError =
  | { kind: 'nothing' }
  | { kind: 'noAmount'; part: string };

/**
 * One line → purchases. idle → (submit) saved at once when the local parser reads every part;
 * otherwise parsing (AI) → confirming (drafts) → (confirm) saved. Errors keep the text.
 */
export type QuickAddVM = {
  /** Saved state loaded; actions do nothing before. */
  ready: boolean;
  text: string;
  setText: (text: string) => void;
  submit: () => void;
  status: 'idle' | 'parsing' | 'confirming' | 'error';
  error: QuickAddError | null;
  /** 'ai' = sorted by /api/ai/parse; 'local' = our own parser, with parts it could not place. */
  draftSource: 'ai' | 'local' | null;
  drafts: SpendDraftVM[];
  setDraftCategory: (key: string, category: CostCategory) => void;
  confirm: () => void;
  cancel: () => void;
  /** Categories a purchase can go in (no debt payments). */
  categories: readonly CostCategory[];
  presets: SpendPresetVM[];
  addPreset: (id: SpendPresetId) => void;
  /** The last save, until undone or replaced. */
  lastAdded: { count: number } | null;
  undo: () => void;
  speech: {
    /** The browser has speech recognition (Web Speech API); hide the mic otherwise. */
    supported: boolean;
    listening: boolean;
    error: boolean;
    toggle: () => void;
  };
};

/** The month so far from the daily log. Numbers from the engine (dailyMonthToDate, monthEnd, safeToSpendToday). */
export type SpendSummaryVM = {
  /** 'YYYY-MM' (local calendar). */
  month: string;
  day: number;
  spent: Money;
  /** The usual month's spend (planned). */
  usual: Money;
  usualFromHistory: boolean;
  /** monthEnd with the log as the month so far. */
  projected: Money;
  safeToday: Money;
  daysLeft: number;
  /** Usual bills not paid yet this month. */
  billsDue: Money;
  /** usual − spent − billsDue; negative = over the usual month. */
  remaining: Money;
  entryCount: number;
};

export type SpendEntryVM = { id: string; category: CostCategory; amount: Money; label?: string };
export type SpendDayVM = { date: string; day: number; total: Money; entries: SpendEntryVM[] };

/** /spend */
export type SpendVM = {
  status: 'loading' | 'ready';
  summary: Loadable<SpendSummaryVM>;
  /** This month's days with entries, newest first. */
  days: SpendDayVM[];
  /** This month's totals per category (non-zero only, largest first). */
  byCategory: { category: CostCategory; amount: Money }[];
  remove: (id: string) => void;
  quickAdd: QuickAddVM;
};
