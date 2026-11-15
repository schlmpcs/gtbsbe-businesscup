// View-model contracts of Accounts, Account detail and Add account (MP11, #171). ui/ may import only
// this file, @/ui-kit/** and @/copy (lint-enforced). Hooks: useAccounts, useAccount(id), useAddAccount.
// Units: every Money is unrounded US dollars; a balance is always >= 0 and `kind` says whether it counts
// for (asset) or against (liability) net worth. Rates are decimals per year (0.2436 = 24.36%), except
// the add-account form's text inputs, which hold what the person typed (see `AddAccountFieldVM`).
// Names: copy.planner.accountGroups[group] for groups, copy.accounts for the screens' own words.
// Privacy (CLAUDE.md rule 6): account names and balances stay in this browser, except one account's
// type, name and value when the person taps "Estimate with AI" (/api/ai/growth; not stored).
import type { Account, AccountGroup, Debt, Estimate, Money, Rate, YearMonth } from '@lifeguessr/types';
import type { DownloadOutcome } from '@/lib/download';
import type { TransactionRowVM, NewTransactionInput } from '@/features/transactions/model/types';

export type { Account, AccountGroup, Estimate, Money, Rate, YearMonth } from '@lifeguessr/types';
export type { DownloadOutcome } from '@/lib/download';
export type { TransactionRowVM, NewTransactionInput } from '@/features/transactions/model/types';

export type AccountKind = 'asset' | 'liability';
export type AccountPeriod = '1m' | '3m' | '1y' | 'all';
export type SummaryMode = 'totals' | 'percent';

/** One point of a balance chart: the balance (net worth for the whole picture) at the end of a month. */
export type BalancePointVM = { month: YearMonth; value: Money };

export type AccountRowVM = {
  id: string;
  name: string;
  group: AccountGroup;
  kind: AccountKind;
  /** The balance (>= 0). */
  balance: Money;
  /** The balance is a rough number the person gave, not an exact one. */
  isEstimate: boolean;
  /** Left out of net worth and the plan. */
  excluded: boolean;
  /** Balance change over the last month; null without a balance a month back. */
  change1m: Money | null;
  /** Where the detail page is. */
  href: string;
};

export type AccountGroupVM = {
  group: AccountGroup;
  kind: AccountKind;
  /** Sum of the group's accounts that count (excluded ones left out). */
  total: Money;
  /** Change of those accounts over the last month; null without a balance a month back. */
  change1m: Money | null;
  accounts: AccountRowVM[];
};

/** One bar of the assets-versus-liabilities summary. */
export type SummaryBarVM = {
  kind: AccountKind;
  total: Money;
  /** Share of assets + liabilities, 0..1 (0 when both are 0). */
  share: Rate;
  /** The groups inside the bar, largest first; `share` is of this bar's total. */
  segments: { group: AccountGroup; amount: Money; share: Rate }[];
};

export type AccountsVM = {
  /** False until saved state is loaded (always true on fixtures). */
  ready: boolean;
  /** No accounts at all: show the "add your first account" state. */
  isEmpty: boolean;
  /** Assets - liabilities, excluded accounts left out. */
  netWorth: Money;
  /** Over the last month, like for like (an account added this month is not growth); null when no account had a balance a month back. */
  change1m: Money | null;
  period: AccountPeriod;
  setPeriod: (period: AccountPeriod) => void;
  /** Net worth history for `period`, oldest first, ending with this month. */
  chart: BalancePointVM[];
  /** Asset groups first, then liability groups; empty groups are left out. */
  groups: AccountGroupVM[];
  summaryMode: SummaryMode;
  setSummaryMode: (mode: SummaryMode) => void;
  summary: { assets: SummaryBarVM; liabilities: SummaryBarVM };
  /** Every account is manual, so there is nothing to refresh: hide the button while false. */
  canRefresh: boolean;
  /** The add-account flow is open (useAddAccount drives it). */
  adding: boolean;
  /** Opens the add-account flow. */
  add: () => void;
  /** No-op for manual accounts. */
  refreshAll: () => void;
  /** Saves the accounts as a CSV file. */
  exportCsv: () => DownloadOutcome;
};

// ----- Account detail ------------------------------------------------------------------------------

export type AccountSummaryVM = {
  group: AccountGroup;
  /** Not in the Account contract yet (needs `creditLimit` in packages/types): always null for now. */
  creditLimit: Estimate<Money> | null;
  apr: Rate | null;
  minPayment: Estimate<Money> | null;
  debtKind: Debt['kind'] | null;
  /** The month of the last balance edit; null for an account with no history. */
  lastUpdated: YearMonth | null;
  /** The month of the first balance. */
  created: YearMonth | null;
  /**
   * The yearly change of an asset with that field (investments, retirement, real estate, vehicle, other);
   * null for other types. `rate` null = the plan's default applies. `aiReason`: the rate is an accepted
   * AI estimate: label it "AI estimate" with this reason.
   */
  growth: { rate: Rate | null; aiReason: string | null } | null;
};

/**
 * "Estimate with AI" next to a yearly change field. The AI only proposes the rate (checked against the
 * envelope); it fills the field, the person can edit it, and the engine projects with whatever is saved.
 */
export type GrowthAiFieldVM = {
  status: 'idle' | 'loading' | 'filled' | 'error';
  /** A name and a valid value are there to send. */
  canAsk: boolean;
  /** Why nothing was filled (status 'error'); null otherwise. */
  message: string | null;
  ask: () => void;
};

/** The yearly change edit on Account detail (assets with the field). */
export type AccountGrowthVM = {
  /** The rate as typed, in percent ("-12" = −0.12 per year); blank = the plan's default. */
  text: string;
  setText: (text: string) => void;
  /** The plan's default as it would be typed (e.g. "−15"), or null when it depends on the area. */
  placeholder: string | null;
  hint: string | null;
  /** True after a save with text that is not a percent. */
  error: boolean;
  /** The field holds the AI's proposal (untouched): label it "AI estimate" with this reason. */
  aiReason: string | null;
  /** Stores the rate (with its AI note when the field still holds the AI's proposal); false for invalid text. */
  save: () => boolean;
  ai: GrowthAiFieldVM;
};

export type AccountDetailVM = AccountRowVM & {
  chart: BalancePointVM[];
  summary: AccountSummaryVM;
  /** This account's lines, newest first. */
  transactions: TransactionRowVM[];
};

export type AccountVM = {
  ready: boolean;
  /** False for an unknown id (or a deleted account): show "not found". */
  found: boolean;
  account: AccountDetailVM | null;
  period: AccountPeriod;
  setPeriod: (period: AccountPeriod) => void;
  /** Sets the balance (>= 0) for this month; false when `value` is not a valid balance. */
  editBalance: (value: Money, isEstimate?: boolean) => boolean;
  /** False for a blank name. */
  rename: (name: string) => boolean;
  /** Leaves the account out of (true) or back in (false) net worth and the plan; no argument toggles. */
  exclude: (excluded?: boolean) => void;
  /** Removes the account; its lines stay in the ledger without an account. */
  delete: () => void;
  /** The yearly change edit with "Estimate with AI"; null for types without that field (or no account). */
  growth: AccountGrowthVM | null;
  /** Adds a line on this account; returns its id, or null when the input is invalid. */
  addTransaction: (input: Omit<NewTransactionInput, 'accountId'>) => string | null;
};

// ----- Add account ---------------------------------------------------------------------------------

export type AddAccountStep = 'pick-type' | 'form';

export type AddAccountFieldId = 'name' | 'balance' | 'apr' | 'minPayment' | 'debtKind' | 'growth';

/** Keys of copy.accounts.fields: a field's id, or 'value' for the money field of a thing you own (vehicle, real estate, other). */
export type AddAccountLabelKey = AddAccountFieldId | 'value';

/**
 * One input of the form. `value` is the text as typed: 'money' in dollars ("1,250.50"), 'percent' in
 * percent ("22.8" = 0.228 per year; the hook converts on submit), 'select' one of `options`.
 * `isEstimate` is the "I'm not sure" tag the person can set on a money field (`canBeEstimate`), or that
 * we set when we filled the field in ourselves (`defaulted`, e.g. a card's minimum payment).
 */
export type AddAccountFieldVM = {
  id: AddAccountFieldId;
  /** Key into copy.accounts.fields. */
  labelKey: AddAccountLabelKey;
  input: 'text' | 'money' | 'percent' | 'select';
  value: string;
  required: boolean;
  canBeEstimate: boolean;
  isEstimate: boolean;
  /** Left blank, we fill it in on submit (and tag it an estimate). */
  defaulted: boolean;
  options?: Debt['kind'][];
  /** Set only after a failed `submit`. */
  error: 'required' | 'invalid' | null;
  /** Placeholder text, already formatted (e.g. "−15", the plan's default yearly change of a vehicle); null for the input's own default. */
  placeholder: string | null;
  /** The line under the field, already worded (from copy.accounts.form); null for none. */
  hint: string | null;
  /** 'growth' only: the field holds the AI's proposal (untouched): label it "AI estimate" with this reason. */
  aiReason: string | null;
};

export type AddAccountVM = {
  step: AddAccountStep;
  /** The account types to pick from, in display order. */
  groups: { group: AccountGroup; kind: AccountKind }[];
  /** Null on 'pick-type'. */
  group: AccountGroup | null;
  /** The form's title (e.g. "Add asset: Vehicle"); null on 'pick-type'. */
  title: string | null;
  fields: AddAccountFieldVM[];
  /** "Estimate with AI" for the yearly change field; null for types without that field. */
  growthAi: GrowthAiFieldVM | null;
  pickType: (group: AccountGroup) => void;
  setField: (id: AddAccountFieldId, value: string) => void;
  setEstimate: (id: AddAccountFieldId, isEstimate: boolean) => void;
  /** Adds the account and closes the flow; returns its id, or null (with `error` set on the fields) when the form is invalid. */
  submit: () => string | null;
  /** Back to 'pick-type', keeping nothing typed. */
  back: () => void;
  /** Closes the flow and clears the form. */
  close: () => void;
};

/** What `submit` stores: the Account without its id. */
export type NewAccount = Omit<Account, 'id'>;
